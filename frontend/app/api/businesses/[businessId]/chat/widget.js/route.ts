/**
 * Public embeddable native chat widget — paste-on-site script, no iframe.
 * Usage: <script src="https://HOST/api/businesses/BUSINESS_ID/chat/widget.js" async></script>
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params;
  const id = String(businessId ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!id) {
    return new Response("/* businessId required */", {
      status: 400,
      headers: { "Content-Type": "application/javascript; charset=utf-8" },
    });
  }

  const js = `(function(){
  if (window.__vtChatLoaded) return;
  window.__vtChatLoaded = true;
  var BID = ${JSON.stringify(id)};
  var s = document.currentScript || (function(){var a=document.getElementsByTagName('script');return a[a.length-1];})();
  var origin = (s && s.src) ? s.src.replace(/\\/api\\/businesses\\/[^/]+\\/chat\\/widget\\.js.*$/, '') : window.location.origin;
  var storageKey = 'vt_chat_thread_' + BID;
  var threadId = null;
  try { threadId = window.localStorage.getItem(storageKey); } catch (e) {}
  if (!threadId) {
    threadId = 'thread_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    try { window.localStorage.setItem(storageKey, threadId); } catch (e) {}
  }
  var contactCaptured = false;

  var root = document.createElement('div');
  root.id = 'vt-native-chat';
  root.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483000;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
  root.innerHTML =
    '<button id="vt-chat-toggle" aria-label="Open chat" style="border:0;border-radius:999px;background:#0f172a;color:#fff;padding:14px 18px;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 8px 24px rgba(15,23,42,.25)">💬 Chat</button>' +
    '<div id="vt-chat-panel" style="display:none;flex-direction:column;width:340px;max-width:92vw;height:460px;max-height:76vh;background:#fff;border:1px solid #e2e8f0;border-radius:14px;margin-top:10px;box-shadow:0 16px 40px rgba(15,23,42,.22);overflow:hidden">' +
      '<div style="padding:14px 16px;font-weight:700;font-size:14px;color:#fff;background:#0f172a;display:flex;align-items:center;justify-content:space-between">' +
        '<span>Chat with us</span>' +
        '<button id="vt-chat-close" aria-label="Close chat" style="border:0;background:transparent;color:#fff;font-size:18px;cursor:pointer;line-height:1;padding:0">×</button>' +
      '</div>' +
      '<div id="vt-chat-log" style="flex:1;overflow:auto;padding:14px;font-size:13.5px;line-height:1.45;color:#0f172a;background:#f8fafc"></div>' +
      '<div id="vt-chat-contact" style="display:none;padding:10px 12px;border-top:1px solid #e2e8f0;gap:6px;flex-direction:column">' +
        '<input id="vt-chat-name" placeholder="Name (optional)" style="height:32px;border:1px solid #cbd5e1;border-radius:8px;padding:0 10px;font-size:13px" />' +
        '<input id="vt-chat-email" placeholder="Email (optional, for a reply)" style="height:32px;border:1px solid #cbd5e1;border-radius:8px;padding:0 10px;font-size:13px" />' +
      '</div>' +
      '<form id="vt-chat-form" style="display:flex;gap:8px;padding:10px 12px;border-top:1px solid #e2e8f0;background:#fff">' +
        '<input id="vt-chat-input" placeholder="Ask a question…" autocomplete="off" style="flex:1;height:36px;border:1px solid #cbd5e1;border-radius:8px;padding:0 10px;font-size:13.5px" />' +
        '<button type="submit" id="vt-chat-send" style="border:0;border-radius:8px;background:#0f172a;color:#fff;padding:0 14px;font-weight:650;font-size:13px;cursor:pointer">Send</button>' +
      '</form>' +
    '</div>';
  document.body.appendChild(root);

  var open = false;
  var toggle = document.getElementById('vt-chat-toggle');
  var closeBtn = document.getElementById('vt-chat-close');
  var panel = document.getElementById('vt-chat-panel');
  var log = document.getElementById('vt-chat-log');
  var form = document.getElementById('vt-chat-form');
  var input = document.getElementById('vt-chat-input');
  var sendBtn = document.getElementById('vt-chat-send');
  var contactBox = document.getElementById('vt-chat-contact');
  var nameField = document.getElementById('vt-chat-name');
  var emailField = document.getElementById('vt-chat-email');

  function setOpen(next) {
    open = next;
    panel.style.display = open ? 'flex' : 'none';
    if (open && !log.childElementCount) {
      addBubble('assistant', "Hi! Ask me anything — I'll answer from what this business has taught me, or get a teammate to follow up.");
    }
    if (open) input.focus();
  }
  toggle.addEventListener('click', function () { setOpen(!open); });
  closeBtn.addEventListener('click', function () { setOpen(false); });

  function addBubble(role, text) {
    var row = document.createElement('div');
    row.style.margin = '0 0 10px';
    row.style.display = 'flex';
    row.style.justifyContent = role === 'visitor' ? 'flex-end' : 'flex-start';
    var bubble = document.createElement('div');
    bubble.style.maxWidth = '85%';
    bubble.style.whiteSpace = 'pre-wrap';
    bubble.style.padding = '8px 12px';
    bubble.style.borderRadius = '12px';
    bubble.style.fontSize = '13.5px';
    if (role === 'visitor') {
      bubble.style.background = '#0f172a';
      bubble.style.color = '#fff';
    } else {
      bubble.style.background = '#e2e8f0';
      bubble.style.color = '#0f172a';
    }
    bubble.textContent = text;
    row.appendChild(bubble);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return bubble;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = String(input.value || '').trim();
    if (!msg) return;
    addBubble('visitor', msg);
    input.value = '';
    sendBtn.disabled = true;
    var thinking = addBubble('assistant', '…');
    var payload = { message: msg, threadId: threadId };
    if (!contactCaptured) {
      var nm = String(nameField.value || '').trim();
      var em = String(emailField.value || '').trim();
      if (nm) payload.name = nm;
      if (em) payload.email = em;
    }
    fetch(origin + '/api/businesses/' + encodeURIComponent(BID) + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (res) { return res.json(); }).then(function (data) {
      thinking.textContent = (data && data.reply) ? data.reply : "Thanks — a teammate will follow up shortly.";
      if (data && data.threadId) {
        threadId = data.threadId;
        try { window.localStorage.setItem(storageKey, threadId); } catch (e) {}
      }
      if (data && data.contactCreated) {
        contactCaptured = true;
        contactBox.style.display = 'none';
      } else if (!contactCaptured) {
        contactBox.style.display = 'flex';
      }
    }).catch(function () {
      thinking.textContent = 'Sorry — chat is temporarily unavailable. Please try again shortly.';
    }).finally(function () {
      sendBtn.disabled = false;
      input.focus();
    });
  });
})();`;

  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
