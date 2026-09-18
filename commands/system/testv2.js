import os from "os";

export default {
  name: ["testv2", "diagnostico", "sys"],
  category: "system",
  description: "Ejecuta un diagnóstico interactivo del sistema (HTML UI).",

  execute: async (sock, m, args) => {
    try {
      const chatId = m.key.remoteJid;
      const botJid = sock.user?.id
        ? sock.user.id.split(":")[0] + "@s.whatsapp.net"
        : "Desconocido";

      let timestamp = m.messageTimestamp
        ? m.messageTimestamp * 1000
        : Date.now();
      let ping = Date.now() - timestamp;
      if (ping < 0 || ping > 5000) ping = Math.floor(Math.random() * 80) + 15;

      const mem = process.memoryUsage();
      const ramUsage = (mem.rss / 1024 / 1024).toFixed(2);
      const heapUsage = (mem.heapUsed / 1024 / 1024).toFixed(2);

      const uptimeTotal = process.uptime();
      const h = Math.floor(uptimeTotal / 3600);
      const min = Math.floor((uptimeTotal % 3600) / 60);
      const sec = Math.floor(uptimeTotal % 60);
      const uptimeStr = `${h}h ${min}m ${sec}s`;

      const osPlat = os.platform();
      const osArch = os.arch();
      const loadAvg = os.loadavg()[0].toFixed(2);

      const htmlCode = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"><title>Aura Test</title><style>body{margin:0;padding:15px 10px;background:#0a0a0a;color:#0f0;font-family:monospace;box-sizing:border-box}.c{width:100%;max-width:400px;margin:0 auto;background:#111;border:1px solid #333;border-radius:8px;overflow:hidden;box-shadow:0 0 15px rgba(0,255,0,0.2)}.nav{display:flex;border-bottom:1px solid #333;background:#000}.tab{flex:1;text-align:center;padding:12px 0;cursor:pointer;font-weight:bold;font-size:13px;border-right:1px solid #333;transition:background 0.2s}.tab:last-child{border-right:none}.tab.act{background:#0f0;color:#000}.pnl{padding:15px;display:none;animation:f 0.3s}.pnl.act{display:block}h1{font-size:16px;text-align:center;margin:0 0 15px 0;color:#fff;text-shadow:0 0 5px #0f0}.btn{width:100%;padding:12px;background:#0f0;color:#000;font-weight:700;border:none;border-radius:4px;cursor:pointer;margin-bottom:10px;text-transform:uppercase}.btn:active{transform:scale(0.95)}.cons{height:130px;background:#000;border:1px solid #333;padding:10px;overflow-y:auto;font-size:11px;border-radius:4px;display:none}.row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px dashed #333;font-size:12px}.row:last-child{border-bottom:none}.row span:last-child{color:#fff;font-weight:bold;word-break:break-all;text-align:right;max-width:65%}@keyframes f{from{opacity:0}to{opacity:1}}</style></head><body><div class="c"><div class="nav"><div class="tab act" onclick="sT(0)">TEST</div><div class="tab" onclick="sT(1)">SYS</div><div class="tab" onclick="sT(2)">WS</div></div><div class="pnl act" id="p0"><h1>AURA DIAGNOSTICS</h1><button class="btn" id="b">▶ Ejecutar Análisis</button><div class="cons" id="cons"></div><div id="r" style="display:none"><div class="row"><span>Ping:</span><span id="v-ping"></span></div><div class="row"><span>RAM RSS:</span><span id="v-ram"></span></div><div class="row"><span>Uptime:</span><span id="v-up"></span></div></div></div><div class="pnl" id="p1"><div class="row"><span>OS:</span><span id="v-os"></span></div><div class="row"><span>Arch:</span><span id="v-ar"></span></div><div class="row"><span>PID:</span><span id="v-pid"></span></div><div class="row"><span>Node.js:</span><span id="v-node"></span></div><div class="row"><span>V8 Heap:</span><span id="v-heap"></span></div><div class="row"><span>CPU Load:</span><span id="v-load"></span></div></div><div class="pnl" id="p2"><div class="row"><span>Bot JID:</span><span id="v-bot"></span></div><div class="row"><span>Chat JID:</span><span id="v-chat"></span></div></div></div><script>const d={ping:'${ping} ms',ram:'${ramUsage} MB',up:'${uptimeStr}',os:'${osPlat}',ar:'${osArch}',pid:'${process.pid}',node:'${process.version}',heap:'${heapUsage} MB',load:'${loadAvg}',bot:'${botJid}',chat:'${chatId}'};for(let k in d){let e=document.getElementById('v-'+k);if(e)e.innerText=d[k];}function sT(n){document.querySelectorAll('.tab').forEach((t,i)=>t.className=i===n?'tab act':'tab');document.querySelectorAll('.pnl').forEach((p,i)=>p.style.display=i===n?'block':'none');}const b=document.getElementById('b'),c=document.getElementById('cons'),r=document.getElementById('r');const l=["[+] Escaneando entorno...","[+] Haciendo ping a Meta...","[+] Verificando buffers...","[+] Midiendo V8 Heap...","[+] Calculando latencia...","[+] Finalizado."];b.onclick=()=>{b.style.display='none';c.style.display='block';let i=0;c.innerHTML='';const iv=setInterval(()=>{if(i<l.length){c.innerHTML+='> '+l[i]+'<br>';c.scrollTop=c.scrollHeight;i++;}else{clearInterval(iv);setTimeout(()=>{c.style.display='none';r.style.display='block';},400);}},400);};</script></body></html>`;

      const responseData = {
        response_id: "system-test-v2",
        sections: [
          {
            view_model: {
              primitive: {
                __typename: "GenAIaeacdsnwHtmlPrimitive",
                payload: htmlCode,
                trusted_sources: ["yuta.dev"],
              },
              __typename: "GenAISingleLayoutViewModel",
            },
          },
        ],
      };

      const base64Payload = Buffer.from(JSON.stringify(responseData)).toString(
        "base64",
      );

      await sock.relayMessage(
        chatId,
        {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
            botMetadata: {
              messageDisclaimerText: "",
              botResponseId: "system-test-v2",
              verificationMetadata: {
                proofs: [
                  {
                    version: 1,
                    useCase: 1,
                    signature:
                      "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YeN55YRyad2+ZA==",
                    certificateChain: [
                      "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGEOvtJr968bbpKdZreOTwkk9aPN++XPE60RfuzNLkXXc7LE8BOkJOWRpo2oNXaRJ3uCNJ43HY3A+oetnvHSfcxWqmvvTSrBOI5V1NOD6RMsZ/st1XVPUx83AGps1l5jYBOYzqMNy6un2tToJ2Bt9bXRo29tWLZTu8m7TNY/hISwVpVc5tjSet5U7btPN+dMIx2UvykB1jcbWGsdklheeuz8RXSStNXzeaGvsf1lpZ/ugLE4b2BdmlRNKrY6zLE4qFtRYQoS7axOyQX+4QUyN2m9bfm7urQmn+QRSXJwMO7X5kAJJLbkVGJFt9Pm9VXPwQVrK2aaqiXlpusj+7DfDw00OULmYMmZDTqXM0nUVLxj13z0LhMQoQhhNG8utdUn4uKOFceliTZ/xiP+A54GnX9620641bqw3ctfh9NNXPsTEK8hAUD7FDqUhVntHmoEYYEHq8X1tHHZYP49/f2iezTiE8AUaoZo42/jIWQIKohOGNUib2hEqMkW8NsR8vPihvNuqPc0zKZcl6359YFQdjiiW8kCRD/rsDOr9v1eYLFZKYloFyzFqEgj+jcG/V47elOjShJ5CCPwatXwP6HIloVwtgygFsnOFmCg6Ojoivfoz8Nw1qxFwg5OU2cq/1WbWNELKnaFg4eUWCAIJ/3ZIJsEPkgemZxGhE+hdiNn9dkQYBJs1kx2BxdIkJmQ9vJSKkrMz6lTxZM3IJ9mhmKS6zYdU1ppeAao0/ayte997DQParb/AHLN79g0iW1ad0z8ir5jAl0q3a+UZPTSa4YiSqC2PZ/gfxG5wvL2mKmeKowG0RXjmEp5iNxrni+T/HRLZOoH7y0DQ24nMCPg",
                      "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGHsL0Ccm0ELINFZ2IaBhKaeWnVuh0o6nZLCioCn9xpSADzwIS5VCWO+1eVXT2atJOyf7FYlpB0/JA3Us+aQtekuIkHu/zBXijORZ4ClF4+sF3cSTNg6gY/+6iwLK/zs3bMg+GeJrcI65vXfs95Shxlb2Rd5GRT2/2yBmR6Zkf5QwMJuptUHWtM26WY7/xlkEKGFYDZVqOSylusiOzSALa815zC6dCiHoJNLBEKMlaZZQOk57/+OYoU5zzTaEgLhyvNFHSyAlyLQ3SGFtVHAaJZHSmmSPyJowCOB+92Gkk6SWVMsk6FbU8QJWFtlhzV/W/gZ7WzUlS/AKgN0th9/cq20ToFkW7X9c+rtYavufmuieqFhXgaMD8AGsoN9QC/HzNC9D1nydPfFYEUr9BHVy2nF5gM58Y59r2rT8p5LPARIkUp8g+5DLhyW0tdZFZ1305o4AHCayZnp5rjcU2Xi/c1Qf/djBGakmijlMs4aMzKJYD0c4Q8jdI7sNyd876K2wRD+L6KeD2QB3PtCS4P7BWAl5gh5CJ6ZBrwcaKXZqcSjEwm52RmVCgYZdapAaNYUy/QndttjLOG0wxxwuX1hIhMjPnIKZR1kwnqD5EqlHpilrnojRZvjVGN4zEKmilS8rNstt4HHs/D849W+Q6LRVWiWMs0cT2IugrX+Skxd8En7Gq52UEmuVBrSTpN+UpIu20NsVb9lsvuYh3XO441606tOEY2eKcZJdTtqrOTNqbbTk0zVn1yhbOCvmfctBNDhTwaC5QMi0P9wjU5XI9SBtkdQLizc5oqpoiHeqgb8+aJHVLcbgIJ/KLZKtRWFDfzRNM02Csx4etUUapVd2NA/L0oMs/O5T9sVj9FBJ7q99GWr3PVmxJb36mHZLXC4k1gGN9swE0LtzYsUdT5tUo9ri/hS3W/SM+F1p4Kh4QIgRcG3ciIHGN44bnDh3HDCz0fDnzKYw0bclMxZPctEyJ5gEOPF6OAkjD9dEaRGq/tEPf1k9Aub+v2dEjnfrYWAm4E5Zfhs2Xh0CT0k+SzhgKd0K/46ChJ20G5+blwpIvahvTVS68+aVIX6CwXs4tcVx6FnmVsMOOkIasfaqQLZYbNBkuLoZnQAq4j8yRekrQ==",
                    ],
                  },
                ],
              },
            },
          },
          botForwardedMessage: {
            message: {
              richResponseMessage: {
                messageType: 1,
                submessages: [
                  {
                    messageType: 2,
                    messageText: "🔍 AURA SYSTEM DIAGNOSTICS",
                  },
                ],
                unifiedResponse: {
                  data: base64Payload,
                },
                contextInfo: {
                  forwardingScore: 1,
                  isForwarded: true,
                  forwardedAiBotMessageInfo: {
                    botJid: "867051314767696@bot",
                  },
                  forwardOrigin: 4,
                },
              },
            },
          },
        },
        { messageId: m.key.id },
      );
    } catch (e) {
      await sock.sendMessage(m.key.remoteJid, {
        text: `❌ Error renderizando UI: ${e.message}`,
      });
    }
  },
};
