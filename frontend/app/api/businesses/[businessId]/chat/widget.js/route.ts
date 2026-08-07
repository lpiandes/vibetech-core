/**
 * Embeddable native chat widget bootstrap.
 * Usage: <script src="https://HOST/api/businesses/BIZ/chat/widget.js"></script>
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params;
  const js = `
(function(){
  var biz=${JSON.stringify(businessId)};
  if (window.__vtChatLoaded) return; window.__vtChatLoaded=true;
  var root=document.createElement('div');
  root.id='vt-native-chat';
  root.style.cssText='position:fixed;right:16px;bottom:16px;z-index:99999;font-family:system-ui,sans-serif';
  root.innerHTML='<button id="vt-chat-toggle" style="border:0;border-radius:999px;background:#0f172a;color:#fff;padding:12px 16px;font-weight:700;cursor:pointer">Chat</button><div id="vt-chat-panel" style="display:none;width:320px;max-width:92vw;height:420px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;margin-top:8px;box-shadow:0 10px 30px rgba(15,23,42,.18);flex-direction:column;overflow:hidden"><div style="padding:12px;font-weight:700;border-bottom:1px solid #e2e8f0">Chat with us</div><div id="vt-chat-log" style="flex:1;overflow:auto;padding:12px;font-size:14px;color:#0f172a"></div><form id="vt-chat-form" style="display:grid;gap:6px;padding:10px;border-top:1px solid #e2e8f0"><input id="vt-chat-email" placeholder="Email (optional)" style="height:34px;border:1px solid #cbd5e1;border-radius:8px;padding:0 8px"/><div style="display:flex;gap:6px"><input id="vt-chat-input" placeholder="Ask a question" style="flex:1;height:34px;border:1px solid #cbd5e1;border-radius:8px;padding:0 8px"/><button style="border:0;border-radius:8px;background:#0f172a;color:#fff;padding:0 12px;font-weight:650">Send</button></div></form></div>';
  document.body.appendChild(root);
  var open=false, threadId='thread_'+Math.random().toString(36).slice(2,10);
  var toggle=document.getElementById('vt-chat-toggle');
  var panel=document.getElementById('vt-chat-panel');
  var log=document.getElementById('vt-chat-log');
  var form=document.getElementById('vt-chat-form');
  toggle.onclick=function(){ open=!open; panel.style.display=open?'flex':'none'; panel.style.flexDirection='column'; };
  function add(role,text){ var p=document.createElement('div'); p.style.margin='0 0 8px'; p.style.whiteSpace='pre-wrap'; p.textContent=(role==='you'?'You: ':'Us: ')+text; log.appendChild(p); log.scrollTop=log.scrollHeight; }
  form.onsubmit=async function(e){
    e.preventDefault();
    var input=document.getElementById('vt-chat-input');
    var email=document.getElementById('vt-chat-email');
    var msg=String(input.value||'').trim(); if(!msg) return;
    add('you', msg); input.value='';
    try{
      var res=await fetch('/api/businesses/'+encodeURIComponent(biz)+'/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg,email:email.value,threadId:threadId})});
      var data=await res.json();
      add('bot', (data && data.reply) ? data.reply : 'Thanks — we will follow up.');
      if(data && data.threadId) threadId=data.threadId;
    }catch(err){ add('bot','Sorry — chat is temporarily unavailable.'); }
  };
})();`;
  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
