import { NextResponse } from "next/server";

/**
 * Paste-on-site embed script. Loads an iframe pointing at the public embed form.
 * Usage: <script src="https://HOST/embed/{businessId}/form.js" async></script>
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params;
  const id = String(businessId ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!id) {
    return new NextResponse("/* businessId required */", {
      status: 400,
      headers: { "Content-Type": "application/javascript; charset=utf-8" },
    });
  }

  const js = `(function(){
  var BID=${JSON.stringify(id)};
  var s=document.currentScript||(function(){var a=document.getElementsByTagName('script');return a[a.length-1];})();
  var origin=(s&&s.src)?s.src.replace(/\\/embed\\/[^/]+\\/form\\.js.*$/,'') : window.location.origin;
  var wrap=document.createElement('div');
  wrap.setAttribute('data-vibetech-form',BID);
  wrap.style.cssText='width:100%;max-width:420px;margin:0 auto;';
  var iframe=document.createElement('iframe');
  iframe.src=origin+'/embed/'+encodeURIComponent(BID)+'/form';
  iframe.title='Contact form';
  iframe.style.cssText='width:100%;min-height:420px;border:0;border-radius:12px;overflow:hidden;';
  iframe.loading='lazy';
  wrap.appendChild(iframe);
  if(s&&s.parentNode){s.parentNode.insertBefore(wrap,s.nextSibling);}
  else{document.body.appendChild(wrap);}
})();`;

  return new NextResponse(js, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
