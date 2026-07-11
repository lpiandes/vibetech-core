import { AuthError } from "next-auth";
import { NextResponse } from "next/server";

import { signIn } from "@/auth";
import { platformStore } from "@/lib/server/compose";
import { hashPassword, verifyPassword } from "@/lib/server/compose";
import { validateInvitationForDisplay } from "@/lib/server/compose";
import { getSessionUser } from "@/lib/platform/AuthorizedWorkspaceService";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
  const invitation = await platformStore.getInvitationByToken(token);
  const validation = validateInvitationForDisplay(invitation);

  if (validation.reason === "accepted" && validation.invitation) {
    const sessionUser = await getSessionUser();
    if (sessionUser) {
      const membership = await platformStore.getMembership(sessionUser.id, validation.invitation.businessId);
      if (membership?.status === "ACTIVE") {
        return NextResponse.json({ businessId: validation.invitation.businessId, alreadyAccepted: true });
      }
    }
    return NextResponse.json({ error: "This invitation has already been used." }, { status: 400 });
  }

  if (!validation.valid) {
    const messages: Record<string, string> = {
      not_found: "This invitation is not valid.",
      revoked: "This invitation is no longer available.",
      expired: "This invitation has expired.",
    };
    return NextResponse.json({ error: messages[validation.reason ?? "not_found"] }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  const password = String(body?.password ?? "");
  const email = validation.invitation!.email;

  let user = await platformStore.getUserByEmail(email);
  let sessionUser = null;

  if (!user) {
    if (!name || password.length < 8) {
      return NextResponse.json({ error: "Name and password (8+ characters) are required." }, { status: 400 });
    }
    const passwordHash = await hashPassword(password);
    user = await platformStore.createUser({ email, name, passwordHash });
  } else {
    sessionUser = await getSessionUser();
  }

  if (user && sessionUser?.id === user.id) {
    if (name && name !== user.name) {
      user = (await platformStore.updateUserName(user.id, name)) ?? user;
    }
  } else if (password) {
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Incorrect password for existing account." }, { status: 401 });
    }
  } else {
    return NextResponse.json(
      { error: "Sign in with this email to accept the invitation.", needsSignIn: true },
      { status: 401 },
    );
  }

  if (user.email !== email) {
    return NextResponse.json({ error: "Sign in with the invited email address." }, { status: 403 });
  }

  const result = await platformStore.acceptInvitation({
    invitationId: validation.invitation!.id,
    userId: user.id,
  });

  void platformStore
    .recordAuditEvent({
      actorUserId: user.id,
      businessId: validation.invitation!.businessId,
      action: "invitation.accepted",
      targetType: "invitation",
      targetId: validation.invitation!.id,
    })
    .catch((err) => console.error("[invite-accept] audit failed", err));

  const businessId = validation.invitation!.businessId;
  const redirectTo = `/b/${businessId}/home`;
  let sessionEstablished = !!sessionUser && sessionUser.id === user.id;

  if (!sessionEstablished) {
    if (!password) {
      return NextResponse.json(
        { error: "Sign in with this email to accept the invitation.", needsSignIn: true },
        { status: 401 },
      );
    }
    try {
      await signIn("credentials", {
        email: user.email,
        password,
        redirect: false,
      });
      sessionEstablished = true;
    } catch (error) {
      if (error instanceof AuthError) {
        console.error("[invite-accept] signIn failed after accept", error);
        return NextResponse.json(
          {
            error: "Invitation accepted but sign-in failed. Please sign in manually.",
            businessId,
            redirectTo,
            needsSignIn: true,
          },
          { status: 500 },
        );
      }
      throw error;
    }
  }

  return NextResponse.json({
    businessId,
    redirectTo,
    membership: result.membership,
    alreadyAccepted: result.alreadyAccepted,
    userId: user.id,
    sessionEstablished,
  });
  } catch (err) {
    console.error("[invite-accept]", err);
    return NextResponse.json({ error: "Could not accept invitation." }, { status: 500 });
  }
}
