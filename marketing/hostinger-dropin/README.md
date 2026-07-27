# Hostinger vanity redirects

Upload these folders to the Hostinger web root so pretty marketing paths bounce to product subdomains.

| Path on apex | Redirects to |
|--------------|--------------|
| `/AIOperatingSystem/` | `https://app.vtechdevelopment.com` |
| `/SocialChecker/` | `https://social.vtechdevelopment.com` |

Each folder contains `.htaccess` (LiteSpeed/Apache) plus a fallback `index.html` meta-refresh for hosts that ignore rewrite rules.

Also ship the full marketing upgrade from [`../site/`](../site/) (chatbot, ROI, starting-at rates, Why VibeTech, product nav).
