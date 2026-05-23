// ============================================================
// ICF-SL  ai_agent.js
// • Analysis dashboard — fetches from ICF-SL Server via GAS
// • AI Agent modal (GAS-backed Claude chat)
// • Targets filtered by School Status = "Old" from CSV
// ============================================================
(function () {
    'use strict';

    const GAS_URL = 'https://script.google.com/macros/s/AKfycbymRy-M5v0fVLWUjw4IXYhd1oIR2ZvnP_Dzr_iGR-Th0cMIpmE2ntGeujWYH7-C6NHIzA/exec';
    const SHEET_ID = '1cXlYiTMzcRP1BCj9mt1JXoK_pjgWbRtDEEQUPMg2HPs';

    // ════════════════════════════════════════════════════════
    //  AUTO-START  — no login required
    //  script_option2.js calls showLoginScreen() after the CSV
    //  loads. We override it to skip directly to startApp().
    // ════════════════════════════════════════════════════════
    (function patchAutoStart() {
        // Override showLoginScreen → auto-start as admin
        window.showLoginScreen = function () {
            if (window.state) {
                window.state.currentUser = 'admin';
                window.state.isAdmin     = true;
                window.LOCATION_DATA     = window.ALL_LOCATION_DATA || {};
            }
            window.startApp && window.startApp('ICF-SL', true);
        };

        // Override hideLoginScreen → just show appMain (loginScreen stub stays hidden)
        window.hideLoginScreen = function () {
            const ls = document.getElementById('loginScreen');
            if (ls) ls.style.display = 'none';
            const am = document.getElementById('appMain');
            if (am) { am.style.display = 'flex'; am.style.flexDirection = 'column'; }
            if (typeof cacheImagesForOffline === 'function') cacheImagesForOffline();
        };

        // Override handleLogout → no-op (no login to return to)
        window.handleLogout = function () { /* no login screen */ };
    })();

    // ════════════════════════════════════════════════════════
    //  STYLES
    // ════════════════════════════════════════════════════════
    const style = document.createElement('style');
    style.textContent = `
    /* ── AI Agent modal ── */
    #icfAiOverlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9100;display:none;justify-content:center;align-items:flex-end;padding:12px;}
    #icfAiOverlay.show{display:flex;}
    #icfAiModal{background:#fff;border-radius:16px 16px 12px 12px;border:3px solid #004080;width:100%;max-width:680px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 12px 48px rgba(0,0,0,.35);overflow:hidden;}
    .icf-ai-head{background:linear-gradient(135deg,#002d5a,#004080);color:#fff;padding:13px 18px;display:flex;align-items:center;gap:12px;flex-shrink:0;}
    .icf-ai-head-icon{width:34px;height:34px;background:rgba(255,255,255,.15);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
    .icf-ai-head-icon svg{width:18px;height:18px;stroke:#fff;}
    .icf-ai-head-info{flex:1;}
    .icf-ai-head-title{font-family:'Oswald',sans-serif;font-size:15px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;line-height:1.2;}
    .icf-ai-head-sub{font-size:10px;color:rgba(255,255,255,.7);}
    .icf-ai-head-actions{display:flex;gap:6px;}
    .icf-ai-hbtn{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:7px;padding:5px 10px;cursor:pointer;color:#fff;font-family:'Oswald',sans-serif;font-size:11px;letter-spacing:.5px;display:flex;align-items:center;gap:4px;transition:background .15s;}
    .icf-ai-hbtn:hover{background:rgba(255,255,255,.22);}
    .icf-ai-hbtn svg{width:12px;height:12px;stroke:#fff;}
    .icf-ai-hbtn.gold{background:rgba(240,165,0,.25);border-color:rgba(240,165,0,.5);}
    .icf-ai-stats{background:#e8f1fa;border-bottom:2px solid #c5d9f0;padding:7px 14px;display:flex;gap:14px;flex-shrink:0;overflow-x:auto;}
    .icf-ai-stats::-webkit-scrollbar{display:none;}
    .icf-ai-stat{text-align:center;white-space:nowrap;}
    .icf-ai-stat-val{font-family:'Oswald',sans-serif;font-size:16px;font-weight:700;color:#004080;line-height:1;}
    .icf-ai-stat-lbl{font-size:9px;color:#555;text-transform:uppercase;letter-spacing:.5px;margin-top:1px;}
    .icf-ai-stat-div{width:1px;background:#bcd3eb;align-self:stretch;margin:2px 0;}
    #icfAiMessages{flex:1;overflow-y:auto;padding:13px 15px;display:flex;flex-direction:column;gap:11px;background:#f8fafd;}
    .icf-msg{display:flex;gap:8px;align-items:flex-start;}.icf-msg.user{flex-direction:row-reverse;}
    .icf-msg-av{width:27px;height:27px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;}
    .icf-msg.ai .icf-msg-av{background:#004080;}.icf-msg.user .icf-msg-av{background:#f0a500;}
    .icf-msg-av svg{width:13px;height:13px;stroke:#fff;}
    .icf-bub{max-width:calc(100% - 42px);padding:9px 13px;border-radius:13px;font-size:13px;line-height:1.55;word-break:break-word;}
    .icf-msg.ai .icf-bub{background:#fff;border:1.5px solid #c5d9f0;border-top-left-radius:4px;color:#222;}
    .icf-msg.user .icf-bub{background:#004080;color:#fff;border-top-right-radius:4px;}
    .icf-bub strong{font-weight:700;}.icf-bub code{background:rgba(0,64,128,.08);border-radius:3px;padding:1px 4px;font-family:monospace;font-size:12px;}
    .icf-msg.user .icf-bub code{background:rgba(255,255,255,.18);}
    .icf-typing{display:flex;align-items:center;gap:4px;padding:5px 0;}
    .icf-typing span{width:7px;height:7px;background:#004080;border-radius:50%;animation:icf-bnc .9s ease-in-out infinite;}
    .icf-typing span:nth-child(2){animation-delay:.15s;}.icf-typing span:nth-child(3){animation-delay:.30s;}
    @keyframes icf-bnc{0%,100%{transform:translateY(0);opacity:.4;}50%{transform:translateY(-5px);opacity:1;}}
    .icf-samples{padding:7px 14px 5px;flex-shrink:0;border-top:1px solid #e0eaf5;}
    .icf-sq-lbl{font-size:9px;font-family:'Oswald',sans-serif;color:#888;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;}
    .icf-sq-row{display:flex;gap:5px;flex-wrap:wrap;}
    .icf-sq{background:#e8f1fa;border:1.5px solid #b3cde8;border-radius:20px;padding:4px 11px;font-size:11px;color:#004080;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .15s;font-family:'Oswald',sans-serif;}
    .icf-sq:hover{background:#004080;color:#fff;border-color:#004080;}
    .icf-inp-row{display:flex;gap:8px;padding:9px 13px 11px;border-top:2px solid #dce8f5;background:#fff;flex-shrink:0;align-items:flex-end;}
    #icfAiInput{flex:1;border:2px solid #c5d9f0;border-radius:22px;padding:8px 14px;font-size:13px;font-family:'Oswald','Segoe UI',Arial,sans-serif;outline:none;resize:none;transition:border-color .2s;line-height:1.4;}
    #icfAiInput:focus{border-color:#004080;}
    #icfAiSend{background:#004080;border:none;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:background .2s,transform .1s;}
    #icfAiSend:hover{background:#00306a;transform:scale(1.06);}
    #icfAiSend:disabled{background:#aaa;cursor:not-allowed;transform:none;}
    #icfAiSend svg{width:16px;height:16px;stroke:#fff;}
    .icf-clr{background:none;border:none;font-size:10px;color:#aaa;cursor:pointer;letter-spacing:.4px;text-transform:uppercase;font-family:'Oswald',sans-serif;padding:0 3px;transition:color .15s;}
    .icf-clr:hover{color:#dc3545;}
    .icf-pill{display:inline-flex;align-items:center;gap:5px;font-size:10px;padding:3px 9px;border-radius:12px;font-family:'Oswald',sans-serif;margin-bottom:7px;}
    .icf-pill.ok{background:#d4edda;color:#155724;}.icf-pill.err{background:#f8d7da;color:#721c24;}.icf-pill.chk{background:#e2e3e5;color:#383d41;}
    .icf-dot{width:6px;height:6px;border-radius:50%;}
    .ok .icf-dot{background:#28a745;}.err .icf-dot{background:#dc3545;}.chk .icf-dot{background:#888;animation:icf-bnc .9s ease-in-out infinite;}
    .icf-welcome{background:#fff;border:2px solid #c5d9f0;border-radius:11px;padding:16px;text-align:center;}
    .icf-welcome-icon{font-size:30px;margin-bottom:7px;}
    .icf-welcome-title{font-family:'Oswald',sans-serif;font-size:14px;color:#004080;font-weight:600;letter-spacing:.5px;margin-bottom:5px;}
    .icf-welcome-body{font-size:12px;color:#555;line-height:1.6;}
    .icf-foot{font-size:9px;color:#aaa;text-align:center;padding:3px;font-style:italic;font-family:'Oswald',sans-serif;}
    @media(max-width:520px){#icfAiModal{max-height:93vh;border-radius:14px 14px 0 0;}}

    /* ── Analysis dashboard ── */
    .an-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:14px;}
    .an-spinner{width:44px;height:44px;border:4px solid #e4eaf2;border-top-color:#004080;border-radius:50%;animation:an-spin 0.8s linear infinite;}
    @keyframes an-spin{to{transform:rotate(360deg);}}
    .an-load-txt{font-family:'Oswald',sans-serif;font-size:13px;color:#607080;letter-spacing:.5px;}
    .an-kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px;}
    .an-kpi{background:#fff;border:2px solid #d0dce8;border-radius:10px;padding:15px 12px;text-align:center;box-shadow:0 2px 8px rgba(0,64,128,.06);}
    .an-kpi.g{border-color:#28a745;background:linear-gradient(135deg,#f0fff4,#fff);}
    .an-kpi.r{border-color:#dc3545;background:linear-gradient(135deg,#fff5f5,#fff);}
    .an-kpi.o{border-color:#f0a500;background:linear-gradient(135deg,#fffbf0,#fff);}
    .an-kpi.p{border-color:#e91e8c;background:linear-gradient(135deg,#fff0f8,#fff);}
    .an-kpi.b{border-color:#004080;background:linear-gradient(135deg,#f0f6ff,#fff);}
    .an-kpi-val{font-family:'Oswald',sans-serif;font-size:26px;font-weight:700;color:#004080;line-height:1;}
    .an-kpi.g .an-kpi-val{color:#28a745;}.an-kpi.r .an-kpi-val{color:#dc3545;}
    .an-kpi.o .an-kpi-val{color:#b8860b;}.an-kpi.p .an-kpi-val{color:#e91e8c;}
    .an-kpi-lbl{font-size:10px;color:#607080;text-transform:uppercase;letter-spacing:.5px;margin-top:4px;font-family:'Oswald',sans-serif;}
    .an-section{background:#fff;border:2px solid #d0dce8;border-radius:10px;overflow:hidden;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,64,128,.06);}
    .an-section-hdr{background:linear-gradient(135deg,#004080,#1a6abf);color:#fff;padding:10px 16px;font-family:'Oswald',sans-serif;font-size:12px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;display:flex;align-items:center;gap:8px;}
    .an-section-hdr svg{width:14px;height:14px;stroke:#fff;fill:none;}
    .an-section-body{padding:14px;}
    .an-charts-2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
    .an-charts-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;}
    .an-chart-card{background:#f8fafd;border:1px solid #e0eaf5;border-radius:8px;padding:12px;}
    .an-chart-label{font-family:'Oswald',sans-serif;font-size:11px;color:#004080;letter-spacing:.4px;text-transform:uppercase;text-align:center;margin-bottom:8px;font-weight:600;}
    .an-chart-card canvas{max-height:200px;}
    .an-tbl-wrap{overflow-x:auto;}
    .an-tbl{width:100%;border-collapse:collapse;font-size:12px;}
    .an-tbl thead tr{background:linear-gradient(135deg,#004080,#1a6abf);}
    .an-tbl th{padding:9px 12px;font-family:'Oswald',sans-serif;font-size:10px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:#fff;text-align:left;white-space:nowrap;}
    .an-tbl td{padding:8px 12px;border-bottom:1px solid #f0f4f8;}
    .an-tbl tr:last-child td{border-bottom:none;}
    .an-tbl tr:nth-child(even) td{background:#fafcff;}
    .an-tbl tr:hover td{background:#eef5ff;}
    .an-cov-cell{display:flex;align-items:center;gap:6px;}
    .an-cov-bar{background:#e4eaf2;border-radius:3px;height:6px;flex:1;overflow:hidden;min-width:40px;}
    .an-cov-fill{height:100%;border-radius:3px;}
    .an-badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;font-family:'Oswald',sans-serif;text-transform:uppercase;letter-spacing:.3px;}
    .an-badge-g{background:#e8f5e9;color:#28a745;}.an-badge-o{background:#fff8e1;color:#b8860b;}.an-badge-r{background:#fdecea;color:#dc3545;}
    .an-no-data{text-align:center;padding:50px 20px;color:#8090a0;font-family:'Oswald',sans-serif;font-size:13px;letter-spacing:.5px;}
    .an-no-data svg{width:40px;height:40px;stroke:#c0ccd8;margin-bottom:10px;}
    /* ── Responsive: Tablet ── */
    @media(max-width:900px){
        .an-charts-3{grid-template-columns:1fr 1fr;}
        .an-kpi-row{grid-template-columns:repeat(3,1fr);}
    }
    /* ── Responsive: Mobile ── */
    @media(max-width:600px){
        .an-charts-2,.an-charts-3{grid-template-columns:1fr;}
        .an-kpi-row{grid-template-columns:repeat(2,1fr);}
        .an-kpi-val{font-size:20px;}
        .an-section-hdr{font-size:11px;}
        .an-tbl th,.an-tbl td{padding:6px 8px;font-size:11px;}
        /* Header responsive */
        .an-dash-title{font-size:13px !important;}
        .an-dash-subtitle{display:none;}
        .an-dash-refresh{min-width:unset !important;padding:7px 10px !important;}
        .an-dash-refresh span{display:none;}
        .an-dash-close span{display:none;}
        /* Filter bar */
        .af-grp{min-width:calc(50% - 4px) !important;flex:unset !important;}
        /* KPI cards */
        .an-kpi{padding:10px 8px;}
    }
    @media(max-width:360px){
        .an-kpi-row{grid-template-columns:repeat(2,1fr);}
        .an-kpi-val{font-size:18px;}
    }
    `;
    document.head.appendChild(style);

    // ════════════════════════════════════════════════════════
    //  AI AGENT MODAL HTML
    // ════════════════════════════════════════════════════════
    document.body.insertAdjacentHTML('beforeend', `
    <div id="icfAiOverlay" onclick="icfAiOverlayClick(event)">
      <div id="icfAiModal">
        <div class="icf-ai-head">
          <div class="icf-ai-head-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          </div>
          <div class="icf-ai-head-info">
            <div class="icf-ai-head-title">ICF Data Agent</div>
            <div class="icf-ai-head-sub">AI · Google Apps Script + Claude</div>
          </div>
          <div class="icf-ai-head-actions">
            <button class="icf-ai-hbtn gold" onclick="icfAiRefreshStats()">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M21 2v6h-6M3 12a9 9 0 0115.36-6.36L21 8M3 22v-6h6M21 12a9 9 0 01-15.36 6.36L3 16"/></svg>SYNC
            </button>
            <button class="icf-ai-hbtn" onclick="icfAiClose()">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>CLOSE
            </button>
          </div>
        </div>
        <div class="icf-ai-stats" id="icfAiStats"><div style="margin:auto;font-size:11px;color:#888;">Loading…</div></div>
        <div id="icfAiMessages">
          <div class="icf-welcome">
            <div class="icf-welcome-icon">🤖</div>
            <div class="icf-welcome-title">Hello! I'm your ICF Data Agent.</div>
            <div class="icf-welcome-body">I analyse all submitted ITN data — coverage, enrollment, gender breakdown, class-level stats and more.<br><br>Powered by <strong>Google Apps Script + Claude AI</strong>. API key stays securely on the server.</div>
          </div>
          <div id="icfGasStatus"></div>
        </div>
        <div class="icf-samples">
          <div class="icf-sq-lbl">✦ Try asking</div>
          <div class="icf-sq-row" id="icfSqRow"></div>
        </div>
        <div class="icf-inp-row">
          <button class="icf-clr" onclick="icfAiClearChat()">↺ Clear</button>
          <textarea id="icfAiInput" rows="1" placeholder="Ask about the ITN distribution data…"
            onkeydown="icfAiKeydown(event)" oninput="icfAiAutoResize(this)"></textarea>
          <button id="icfAiSend" onclick="icfAiSend()">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
        <div class="icf-foot">Session state + ICF-SL Server · API key never leaves the server</div>
      </div>
    </div>`);

    // ════════════════════════════════════════════════════════
    //  SHARED HELPERS
    // ════════════════════════════════════════════════════════
    const SAMPLES = [
        'How many schools have been submitted?','What is the overall ITN coverage rate?',
        'Which district has the most submissions?','Show coverage breakdown by gender',
        'How many ITNs were distributed in total?','List schools with coverage below 80%',
        'What is average enrollment per school?','How many schools are still pending?',
        'Compare boys vs girls ITN coverage','Which schools received IG2 nets?',
        'How many ITNs remain after distribution?','Give me a summary by chiefdom',
        'Which class has the highest coverage?','Who submitted the most records?',
    ];
    function pickN(n){const p=[...SAMPLES],o=[];while(o.length<n&&p.length){const i=Math.floor(Math.random()*p.length);o.push(p.splice(i,1)[0]);}return o;}

    function md(t){
        return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>')
            .replace(/`(.+?)`/g,'<code>$1</code>')
            .replace(/^#{1,3} (.+)$/gm,'<strong style="font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:#004080;display:block;margin-top:6px">$1</strong>')
            .replace(/^- (.+)$/gm,'<span style="display:block;padding-left:14px;margin:2px 0">• $1</span>')
            .replace(/\n\n/g,'<br><br>').replace(/\n/g,'<br>');
    }

    function covColor(p){return p>=80?'#28a745':p>=50?'#f0a500':'#dc3545';}
    function covBadge(p){const c=p>=80?'g':p>=50?'o':'r';return`<span class="an-badge an-badge-${c}">${p}%</span>`;}

    // ════════════════════════════════════════════════════════
    //  GAS CALLS
    // ════════════════════════════════════════════════════════
    async function callGAS(msg, history, context){
        const res=await fetch(GAS_URL,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'ai_query',message:msg,history:(history||[]).slice(-10),context:context||''})});
        if(!res.ok)throw new Error('GAS HTTP '+res.status);
        const d=await res.json();if(!d.success)throw new Error(d.error||'GAS error');return d.reply;
    }

    async function fetchSheetData(){
        try{
            const res = await Promise.race([
                fetch(GAS_URL+'?action=getData'),
                new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),25000))
            ]);
            if(res.ok){
                const d = await res.json();
                const rows = d.rows||d.data||(Array.isArray(d)?d:null);
                if(rows&&rows.length>0){
                    console.log('[Analysis] Loaded',rows.length,'rows from GAS');
                    const r0 = rows[0];
                    console.log('[Analysis] Sample row:',{
                        total_pupils: r0.total_pupils,
                        total_itn:    r0.total_itn,
                        total_boys:   r0.total_boys,
                        total_girls:  r0.total_girls,
                        total_boys_itn: r0.total_boys_itn,
                        total_girls_itn: r0.total_girls_itn
                    });
                    return rows;
                }
            }
        }catch(e){console.warn('[Analysis] GAS fetch failed:',e.message);}
        return [];
    }

    function n(r,key,fallback){
        let v = r[key];
        if((v===undefined||v===''||v===null) && fallback) v = r[fallback];
        if(v===undefined||v===null||v==='') return 0;
        const clean = String(v).replace(/,/g,'').trim();
        return parseFloat(clean)||0;
    }
    function s(r,key,fallback){
        let v = r[key];
        if((v===undefined||v===null||v==='') && fallback) v = r[fallback];
        return String(v||'').trim();
    }

    async function fetchCount(){
        try{
            const r=await fetch(GAS_URL+'?action=count');
            const d=await r.json();
            return d.count!==undefined?d.count:'?';
        }catch{return'?';}
    }

    // ════════════════════════════════════════════════════════
    //  SCHOOL STATUS CSV PARSING & TARGET BUILDING
    //  FILTERS BY "School Status" = "Old"
    // ════════════════════════════════════════════════════════
    
    function parseSchoolStatusCSV() {
        return new Promise((resolve) => {
            Papa.parse('./cascading_data.csv', {
                download: true,
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    window._SCHOOL_STATUS_DATA = results.data || [];
                    console.log('[Targets] Loaded', window._SCHOOL_STATUS_DATA.length, 'schools from CSV');
                    const oldCount = window._SCHOOL_STATUS_DATA.filter(r => (r['School Status'] || '').trim() === 'Old').length;
                    const newCount = window._SCHOOL_STATUS_DATA.filter(r => (r['School Status'] || '').trim() === 'New').length;
                    console.log('[Targets] Old schools:', oldCount, '| New schools:', newCount);
                    resolve();
                },
                error: function(err) {
                    console.warn('[Targets] CSV parse error:', err);
                    window._SCHOOL_STATUS_DATA = [];
                    resolve();
                }
            });
        });
    }

    function buildTargetsFromCSV() {
        // Only count schools with School Status = "Old"
        const oldSchools = (window._SCHOOL_STATUS_DATA || []).filter(r => 
            (r['School Status'] || '').trim() === 'Old'
        );
        
        console.log('[Targets] Building targets from', oldSchools.length, 'Old schools');
        
        const targets = {};
        const chiefdomMap = {};
        const districtMap = {};
        
        oldSchools.forEach(row => {
            const d = (row['District'] || '').trim();
            const c = (row['Chiefdom'] || '').trim();
            const p = (row['Name of PHU'] || row['Facility'] || '').trim();
            const com = (row['Community'] || '').trim();
            const sc = (row['School Name'] || '').trim();
            
            if (!d || !c || !p || !sc) return;
            
            const dk = d.toLowerCase();
            const ck = c.toLowerCase();
            const pk = p.toLowerCase();
            const comk = com.toLowerCase();
            const fullKey = dk+'|'+ck+'|'+pk+'|'+comk+'|'+sc.toLowerCase();
            
            // PHU level: count unique schools
            const phuKey = dk+'|'+ck+'|'+pk;
            if (!targets[phuKey]) targets[phuKey] = 0;
            targets[phuKey]++;
            
            // Track for chiefdom and district aggregation
            const chiefKey = dk+'|'+ck;
            if (!chiefdomMap[chiefKey]) chiefdomMap[chiefKey] = new Set();
            chiefdomMap[chiefKey].add(fullKey);
            
            if (!districtMap[dk]) districtMap[dk] = new Set();
            districtMap[dk].add(fullKey);
        });
        
        // Chiefdom level: unique schools across PHUs
        for (const ck in chiefdomMap) {
            targets[ck] = chiefdomMap[ck].size;
        }
        
        // District level: unique schools across chiefdoms
        for (const dk in districtMap) {
            targets[dk] = districtMap[dk].size;
        }
        
        console.log('[Targets] Built targets with', Object.keys(targets).length, 'entries');
        return targets;
    }

    // ════════════════════════════════════════════════════════
    //  DATA MERGE  (GAS sheet + localStorage)
    // ════════════════════════════════════════════════════════
    let _sheetRows = [];
    let _refreshInterval = null;
    let _refreshCountdown = 60;

    function getLocalRows(){
        const s=window.state||{};
        return[...(s.submittedSchools||[]).map(r=>r.data||r),...(s.pendingSubmissions||[])];
    }

    function mergeData(sheetRows){
        if(sheetRows && sheetRows.length > 0) return sheetRows;
        return getLocalRows();
    }

    // ════════════════════════════════════════════════════════
    //  ANALYSIS CASCADING FILTERS
    // ════════════════════════════════════════════════════════
    function getLoc(){return(window.ALL_LOCATION_DATA&&Object.keys(window.ALL_LOCATION_DATA).length)?window.ALL_LOCATION_DATA:window.LOCATION_DATA||{};}

    function afOpt(sel,opts,disabled){
        const el=document.getElementById(sel);if(!el)return;
        const cur=el.value;
        el.innerHTML='<option value="">All</option>';
        opts.sort().forEach(o=>{const op=document.createElement('option');op.value=op.textContent=o;el.appendChild(op);});
        if(cur&&[...el.options].some(o=>o.value===cur))el.value=cur;
        el.disabled=!!disabled;
    }

    window.afCascade=function(level){
        const loc=getLoc();
        const d  =()=>document.getElementById('af_district' )?.value||'';
        const c  =()=>document.getElementById('af_chiefdom' )?.value||'';
        const f  =()=>document.getElementById('af_facility' )?.value||'';

        const resetBelow=(...ids)=>ids.forEach(id=>{
            const el=document.getElementById(id);
            if(el){el.innerHTML='<option value="">All</option>';el.disabled=true;}
        });

        if(level==='district'){
            resetBelow('af_chiefdom','af_facility');
            if(d()&&loc[d()]) afOpt('af_chiefdom',Object.keys(loc[d()]),false);

        }else if(level==='chiefdom'){
            resetBelow('af_facility');
            if(d()&&c()&&loc[d()]?.[c()]) afOpt('af_facility',Object.keys(loc[d()][c()]),false);

        }else if(level==='facility'){
            resetBelow('af_community','af_school');
            if(d()&&c()&&f()&&loc[d()]?.[c()]?.[f()])
                afOpt('af_community',Object.keys(loc[d()][c()][f()]),false);

        }else if(level==='community'){
            resetBelow('af_school');
            const schools=loc[d()]?.[c()]?.[f()]?.[co()];
            if(schools) afOpt('af_school',schools,false);
        }
        runAnalysis();
    };

    window.clearAnalysisFilters=function(){
        ['af_chiefdom','af_facility'].forEach(id=>{
            const el=document.getElementById(id);
            if(el){el.innerHTML='<option value="">All</option>';el.disabled=true;}
        });
        const dd=document.getElementById('af_district');if(dd)dd.value='';
        runAnalysis();
    };

    function initDistrictFilter(){
        const dd=document.getElementById('af_district');if(!dd)return;
        const loc=getLoc();
        const districts=Object.keys(loc).sort();
        dd.innerHTML='<option value="">All Districts</option>';
        districts.forEach(d=>{const o=document.createElement('option');o.value=o.textContent=d;dd.appendChild(o);});
        if(districts.length===0) console.warn('[Analysis] District filter empty — ALL_LOCATION_DATA keys:',Object.keys(window.ALL_LOCATION_DATA||{}));
    }

    function getFilteredData(allRows){
        let rows=[...allRows];
        const fD  =document.getElementById('af_district' )?.value||'';
        const fC  =document.getElementById('af_chiefdom' )?.value||'';
        const fF  =document.getElementById('af_facility' )?.value||'';
        const lc=s=>(s||'').toLowerCase();
        if(fD)   rows=rows.filter(r=>lc(r.district ||'')===lc(fD));
        if(fC)   rows=rows.filter(r=>lc(r.chiefdom ||'')===lc(fC));
        if(fF)   rows=rows.filter(r=>lc(r.facility ||'')===lc(fF));
        return rows;
    }

    // ════════════════════════════════════════════════════════
    //  CHART INSTANCES
    // ════════════════════════════════════════════════════════
    let anCharts={};
    function destroyCharts(){Object.values(anCharts).forEach(c=>{try{c.destroy();}catch(e){}});anCharts={};}

    const CF={font:{family:"'Oswald',sans-serif"}};
    const chartOpts=(extra={})=>({
        responsive:true,maintainAspectRatio:true,
        plugins:{legend:{labels:{font:{family:"'Oswald',sans-serif",size:11},boxWidth:12}},tooltip:{titleFont:{family:"'Oswald',sans-serif"},bodyFont:{family:"'Oswald',sans-serif"}},...extra},
        ...extra
    });

    function mkChart(id,cfg){
        const el=document.getElementById(id);if(!el)return null;
        const c=new Chart(el,cfg);anCharts[id]=c;return c;
    }

    // ════════════════════════════════════════════════════════
    //  MAIN ANALYSIS RENDER
    // ════════════════════════════════════════════════════════
    window.runAnalysis=function(allRows){
        if(allRows!==undefined)_sheetRows=allRows||[];
        destroyCharts();
        const body=document.getElementById('analysisBody');if(!body)return;
        const all=getFilteredData(mergeData(_sheetRows));
        const total=all.length;

        const sub=document.getElementById('anSubtitle');
        if(sub)sub.textContent=`${total} school${total!==1?'s':''} submitted · Last refreshed ${new Date().toLocaleTimeString('en-SL',{hour:'2-digit',minute:'2-digit'})}`;

        if(!total){
            body.innerHTML=`<div class="an-no-data">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><path d="M3 3h18v18H3zM3 9h18M9 21V9"/></svg>
              <div style="margin-bottom:12px;">No submissions found. ${_sheetRows.length===0?'Could not load data from ICF-SL Server — try refreshing.':'No data matches the selected filters.'}</div>
              ${_sheetRows.length===0?`<button onclick="anRefresh()" style="background:#004080;color:#fff;border:none;border-radius:8px;padding:9px 20px;font-family:'Oswald',sans-serif;font-size:12px;font-weight:600;letter-spacing:.5px;cursor:pointer;">↻ RETRY FETCH</button>`:''}
            </div>`;
            return;
        }

        // Targets come from CSV filtered by "Old" status
        const targets    = window._TARGETS || {};
        const hasTargets = Object.keys(targets).length > 0;
        const fD = (document.getElementById('af_district')?.value||'').trim().toLowerCase();
        const fC = (document.getElementById('af_chiefdom')?.value||'').trim().toLowerCase();
        const fP = (document.getElementById('af_facility')?.value||'').trim().toLowerCase();
        let targetCount = 0;
        if (hasTargets) {
            if (fP && fC && fD) {
                targetCount = targets[fD+'|'+fC+'|'+fP] || 0;
            } else if (fC && fD) {
                targetCount = targets[fD+'|'+fC] || 0;
            } else if (fD) {
                targetCount = targets[fD] || 0;
            } else {
                Object.entries(targets).forEach(([k, v]) => {
                    if (!k.includes('|')) targetCount += v;
                });
            }
        }

        // Aggregate
        let tp=0,ti=0,tb=0,tg=0,tbi=0,tgi=0,tr=0,trem=0;
        const byDist={};
        const cls={b:[0,0,0,0,0],g:[0,0,0,0,0],bi:[0,0,0,0,0],gi:[0,0,0,0,0]};

        all.forEach(r=>{
            const vp =n(r,'total_pupils');
            const vi =n(r,'total_itn');
            const vb =n(r,'total_boys');
            const vg =n(r,'total_girls');
            const vbi=n(r,'total_boys_itn');
            const vgi=n(r,'total_girls_itn');
            const vr =n(r,'itns_received');
            const vrem=n(r,'itns_remaining')||n(r,'itns_remaining_val');
            tp+=vp;ti+=vi;tb+=vb;tg+=vg;tbi+=vbi;tgi+=vgi;tr+=vr;trem+=vrem;
            const d=(r['district']||r['District']||'Unknown');
            if(!byDist[d])byDist[d]={n:0,p:0,i:0,b:0,g:0,bi:0,gi:0};
            byDist[d].n++;byDist[d].p+=vp;byDist[d].i+=vi;byDist[d].b+=vb;byDist[d].g+=vg;byDist[d].bi+=vbi;byDist[d].gi+=vgi;

            for(let c=1;c<=5;c++){
                const cb=n(r,'c'+c+'_boys');
                const cg=n(r,'c'+c+'_girls');
                const cbi=n(r,'c'+c+'_boys_itn');
                const cgi=n(r,'c'+c+'_girls_itn');
                cls.b[c-1]+=cb; cls.g[c-1]+=cg;
                cls.bi[c-1]+=cbi; cls.gi[c-1]+=cgi;
            }
        });

        const ov=tp>0?Math.round((ti/tp)*100):0;
        const bc=tb>0?Math.round((tbi/tb)*100):0;
        const gc=tg>0?Math.round((tgi/tg)*100):0;
        const classLabels=['Class 1','Class 2','Class 3','Class 4','Class 5'];
        const classTot=cls.b.map((b,i)=>b+cls.g[i]);
        const classITN=cls.bi.map((b,i)=>b+cls.gi[i]);
        const classCov=classTot.map((t,i)=>t>0?Math.round((classITN[i]/t)*100):0);
        const boysCov=cls.b.map((b,i)=>b>0?Math.round((cls.bi[i]/b)*100):0);
        const girlsCov=cls.g.map((g,i)=>g>0?Math.round((cls.gi[i]/g)*100):0);
        const distL=Object.keys(byDist).sort();
        const distCov=distL.map(d=>byDist[d].p>0?Math.round((byDist[d].i/byDist[d].p)*100):0);
        const distBoysCov=distL.map(d=>byDist[d].b>0?Math.round((byDist[d].bi/byDist[d].b)*100):0);
        const distGirlsCov=distL.map(d=>byDist[d].g>0?Math.round((byDist[d].gi/byDist[d].g)*100):0);

        // Build HTML
        body.innerHTML=`
        <!-- KPIs -->
        <div class="an-kpi-row">
          ${hasTargets && targetCount>0 ? `<div class="an-kpi b"><div class="an-kpi-val">${targetCount}</div><div class="an-kpi-lbl">Target Schools</div></div>` : ''}
          <div class="an-kpi b"><div class="an-kpi-val">${total}</div><div class="an-kpi-lbl">Submitted Schools</div></div>
          ${hasTargets && targetCount>0 ? `<div class="an-kpi ${targetCount>total?'r':'g'}"><div class="an-kpi-val">${Math.max(0,targetCount-total)}</div><div class="an-kpi-lbl">Remaining Schools</div></div>
          <div class="an-kpi ${Math.round((total/targetCount)*100)>=80?'g':'o'}"><div class="an-kpi-val">${Math.round((total/targetCount)*100)}%</div><div class="an-kpi-lbl">School Progress</div></div>` : ''}
          <div class="an-kpi"><div class="an-kpi-val">${tp.toLocaleString()}</div><div class="an-kpi-lbl">Total Pupils</div></div>
        
          <div class="an-kpi g"><div class="an-kpi-val">${ti.toLocaleString()}</div><div class="an-kpi-lbl">ITNs Distributed</div></div>
          
          <div class="an-kpi ${ov>=80?'g':ov>=50?'o':'r'}"><div class="an-kpi-val">${ov}%</div><div class="an-kpi-lbl">ITNs Coverage</div></div>
          <div class="an-kpi b"><div class="an-kpi-val">${bc}%</div><div class="an-kpi-lbl">Boys ITN Coverage</div></div>
          <div class="an-kpi p"><div class="an-kpi-val">${gc}%</div><div class="an-kpi-lbl">Girls ITN Coverage</div></div>
        </div>

        <!-- Row 1: Coverage donut + Gender enrollment + Gender ITN -->
        <div class="an-section">
          <div class="an-section-hdr"><svg viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>OVERALL SUMMARY</div>
          <div class="an-section-body">
            <div class="an-charts-3">
              <div class="an-chart-card"><div class="an-chart-label">ITN Coverage</div><canvas id="anCovDonut"></canvas></div>
              <div class="an-chart-card"><div class="an-chart-label">Enrollment by Gender</div><canvas id="anEnrollDonut"></canvas></div>
              <div class="an-chart-card"><div class="an-chart-label">ITNs Distributed by Gender</div><canvas id="anItnDonut"></canvas></div>
            </div>
          </div>
        </div>

        <!-- Row 2: Coverage by class -->
        <div class="an-section">
          <div class="an-section-hdr"><svg viewBox="0 0 24 24" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>CLASS-BY-CLASS BREAKDOWN</div>
          <div class="an-section-body">
            <div class="an-charts-2">
              <div class="an-chart-card"><div class="an-chart-label">Coverage % by Class</div><canvas id="anClassCov"></canvas></div>
              <div class="an-chart-card"><div class="an-chart-label">Boys vs Girls Coverage by Class</div><canvas id="anClassGender"></canvas></div>
            </div>
            <div style="margin-top:12px;" class="an-chart-card"><div class="an-chart-label">Enrollment vs ITNs Distributed by Class</div><canvas id="anEnrollVsItn"></canvas></div>
          </div>
        </div>

        <!-- Row 3: By district (only if >1) -->
        ${distL.length>1?`
        <div class="an-section">
          <div class="an-section-hdr"><svg viewBox="0 0 24 24" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>BY DISTRICT</div>
          <div class="an-section-body">
            <div class="an-charts-2">
              <div class="an-chart-card"><div class="an-chart-label">Coverage % by District</div><canvas id="anDistCov"></canvas></div>
              <div class="an-chart-card"><div class="an-chart-label">Boys vs Girls Coverage by District</div><canvas id="anDistGender"></canvas></div>
            </div>
          </div>
        </div>`:''}

        <!-- School table -->
        <div class="an-section">
          <div class="an-section-hdr"><svg viewBox="0 0 24 24" stroke-width="2"><path d="M3 3h18v18H3zM3 9h18M9 21V9"/></svg>ALL SCHOOLS (${total})</div>
          <div class="an-section-body" style="padding:0;">
            <div class="an-tbl-wrap">
              <table class="an-tbl">
                <thead><tr><th>#</th><th>School</th><th>Community</th><th>District</th><th>Pupils</th><th>Boys</th><th>Girls</th><th>ITNs</th><th>Remaining</th><th>Coverage</th><th>Date</th><th>By</th></tr></thead>
                <tbody>
                  ${all.sort((a,b)=>(a.district||'').localeCompare(b.district||'')).map((r,i)=>{
                    const vp=n(r,'total_pupils'),vi=n(r,'total_itn'),vb=n(r,'total_boys'),vg=n(r,'total_girls');
                    const vrem=n(r,'itns_remaining')||n(r,'itns_remaining_val');
                    const cov=vp>0?Math.round((vi/vp)*100):0;
                    const col=covColor(cov);
                    return`<tr>
                      <td style="color:#8090a0;font-size:11px;">${i+1}</td>
                      <td style="font-weight:600;white-space:nowrap;">${s(r,'school_name','School Name')||'—'}</td>
                      <td style="white-space:nowrap;">${s(r,'community','Community / Village')||'—'}</td>
                      <td style="white-space:nowrap;">${s(r,'district','District')||'—'}</td>
                      <td style="text-align:center;">${vp}</td>
                      <td style="text-align:center;color:#004080;">${vb}</td>
                      <td style="text-align:center;color:#e91e8c;">${vg}</td>
                      <td style="text-align:center;font-weight:600;">${vi}</td>
                      <td style="text-align:center;color:${vrem<0?'#dc3545':'#607080'};">${vrem}</td>
                      <td>
                        <div class="an-cov-cell">
                          <div class="an-cov-bar"><div class="an-cov-fill" style="width:${Math.min(100,cov)}%;background:${col};"></div></div>
                          ${covBadge(cov)}
                        </div>
                      </td>
                      <td style="font-size:11px;white-space:nowrap;">${s(r,'distribution_date','Distribution Date')||'—'}</td>
                      <td style="font-size:11px;color:#607080;white-space:nowrap;">${s(r,'submitted_by','Submitted By')||'—'}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>`;

        // Charts
        mkChart('anCovDonut',{type:'doughnut',data:{labels:['Covered','Remaining'],datasets:[{data:[ov,100-ov],backgroundColor:[covColor(ov),'#e8edf2'],borderWidth:3,borderColor:'#fff'}]},options:{...chartOpts(),cutout:'72%',plugins:{legend:{position:'bottom',labels:{font:{family:"'Oswald',sans-serif",size:11},boxWidth:12}},title:{display:true,text:ov+'%',color:covColor(ov),font:{family:"'Oswald',sans-serif",size:22,weight:'700'}}}}});

        mkChart('anEnrollDonut',{type:'doughnut',data:{labels:['Boys','Girls'],datasets:[{data:[tb,tg],backgroundColor:['#004080','#e91e8c'],borderWidth:3,borderColor:'#fff'}]},options:{...chartOpts(),cutout:'60%',plugins:{legend:{position:'bottom',labels:{font:{family:"'Oswald',sans-serif",size:11},boxWidth:12}}}}});

        mkChart('anItnDonut',{type:'doughnut',data:{labels:['Boys','Girls'],datasets:[{data:[tbi,tgi],backgroundColor:['#004080','#e91e8c'],borderWidth:3,borderColor:'#fff'}]},options:{...chartOpts(),cutout:'60%',plugins:{legend:{position:'bottom',labels:{font:{family:"'Oswald',sans-serif",size:11},boxWidth:12}}}}});

        mkChart('anClassCov',{type:'bar',data:{labels:classLabels,datasets:[{label:'Coverage %',data:classCov,backgroundColor:classCov.map(v=>covColor(v)+'cc'),borderColor:classCov.map(covColor),borderWidth:2,borderRadius:6}]},options:{...chartOpts({scales:{y:{beginAtZero:true,max:100,ticks:{callback:v=>v+'%',font:CF.font},grid:{color:'rgba(0,0,0,.05)'}},x:{ticks:{font:CF.font},grid:{display:false}}},plugins:{legend:{display:false},annotation:{}}})}});

        mkChart('anClassGender',{type:'bar',data:{labels:classLabels,datasets:[{label:'Boys',data:boysCov,backgroundColor:'rgba(0,64,128,.75)',borderColor:'#004080',borderWidth:2,borderRadius:5},{label:'Girls',data:girlsCov,backgroundColor:'rgba(233,30,140,.7)',borderColor:'#e91e8c',borderWidth:2,borderRadius:5}]},options:{...chartOpts({scales:{y:{beginAtZero:true,max:100,ticks:{callback:v=>v+'%',font:CF.font},grid:{color:'rgba(0,0,0,.05)'}},x:{ticks:{font:CF.font},grid:{display:false}}}})}});

        mkChart('anEnrollVsItn',{type:'bar',data:{labels:classLabels,datasets:[{label:'Enrolled',data:classTot,backgroundColor:'rgba(0,64,128,.2)',borderColor:'#004080',borderWidth:2,borderRadius:5},{label:'Received ITN',data:classITN,backgroundColor:'rgba(40,167,69,.7)',borderColor:'#28a745',borderWidth:2,borderRadius:5}]},options:{...chartOpts({scales:{y:{beginAtZero:true,ticks:{font:CF.font},grid:{color:'rgba(0,0,0,.05)'}},x:{ticks:{font:CF.font},grid:{display:false}}}})}});

        if(distL.length>1){
            mkChart('anDistCov',{type:'bar',data:{labels:distL,datasets:[{label:'Coverage %',data:distCov,backgroundColor:distCov.map(v=>covColor(v)+'cc'),borderColor:distCov.map(covColor),borderWidth:2,borderRadius:5}]},options:{...chartOpts({indexAxis:'y',scales:{x:{beginAtZero:true,max:100,ticks:{callback:v=>v+'%',font:CF.font},grid:{color:'rgba(0,0,0,.05)'}},y:{ticks:{font:CF.font},grid:{display:false}}},plugins:{legend:{display:false}}})}});

            mkChart('anDistGender',{type:'bar',data:{labels:distL,datasets:[{label:'Boys',data:distBoysCov,backgroundColor:'rgba(0,64,128,.75)',borderColor:'#004080',borderWidth:2,borderRadius:4},{label:'Girls',data:distGirlsCov,backgroundColor:'rgba(233,30,140,.7)',borderColor:'#e91e8c',borderWidth:2,borderRadius:4}]},options:{...chartOpts({indexAxis:'y',scales:{x:{beginAtZero:true,max:100,ticks:{callback:v=>v+'%',font:CF.font},grid:{color:'rgba(0,0,0,.05)'}},y:{ticks:{font:CF.font},grid:{display:false}}}})}});
        }
    };

    // ════════════════════════════════════════════════════════
    //  TAB SWITCHER
    // ════════════════════════════════════════════════════════
    window.switchAnTab = function(tab) {
        const tabs = ['analysis', 'targets', 'dmsphu'];
        const panelMap = { analysis:'analysisBody', targets:'targetsBody', dmsphu:'dmsphuBody' };
        tabs.forEach(t => {
            const btn   = document.getElementById('anTab-' + t);
            const panel = document.getElementById(panelMap[t]);
            const isActive = t === tab;
            if (btn) {
                btn.style.color             = isActive ? '#004080' : '#607080';
                btn.style.borderBottomColor = isActive ? '#c8991a' : 'transparent';
                btn.style.background        = isActive ? '#f4f8ff' : 'none';
            }
            if (panel) panel.style.display = isActive ? 'block' : 'none';
        });
        if (tab === 'targets') renderTargetsTab();
        if (tab === 'dmsphu')  renderDmsPhuTab();
    };

    // ════════════════════════════════════════════════════════
    //  TARGETS TAB — uses same filtered data (Old schools only)
    // ════════════════════════════════════════════════════════
    function getSubmittedSet() {
        return new Set(
            (_sheetRows || [])
                .filter(r => r.school_name)
                .map(r => {
                    const _d  = (r.district  ||r['District']             ||'').trim().toLowerCase();
                    const _c  = (r.chiefdom  ||r['Chiefdom']             ||'').trim().toLowerCase();
                    const _f  = (r.facility  ||r['Health Facility (PHU)']||'').trim().toLowerCase();
                    const _co = (r.community ||r['Community / Village']  ||'').trim().toLowerCase();
                    const _sc = (r.school_name||r['School Name']         ||'').trim().toLowerCase();
                    return _d+'|'+_c+'|'+_f+'|'+_co+'|'+_sc;
                })
        );
    }

    function renderTargetsTab() {
        const body = document.getElementById('targetsBody');
        if (!body) return;
    
        // Get all CSV data
        const allSchools = window._SCHOOL_STATUS_DATA || [];
        const oldSchools = allSchools.filter(r => (r['School Status'] || '').trim() === 'Old');
        const newSchools = allSchools.filter(r => (r['School Status'] || '').trim() === 'New');
        
        // Get current filter from data attribute or default to 'old'
        let currentFilter = body.getAttribute('data-filter') || 'old';
        
        // Get submitted schools from ICF-SL Server
        const submitted = getSubmittedSet();
        
        // Helper to check if a school is submitted (works for both old and new)
        const isSubmitted = (key) => submitted.has(key);
        
        // Function to build tree from a filtered school list
        function buildTreeFromSchools(schools) {
            const tree = {};
            schools.forEach(row => {
                const d = (row['District'] || '').trim();
                const c = (row['Chiefdom'] || '').trim();
                const p = (row['Name of PHU'] || row['Facility'] || '').trim();
                const com = (row['Community'] || '').trim();
                const sc = (row['School Name'] || '').trim();
                const status = (row['School Status'] || '').trim();
                if (!d || !c || !p || !sc) return;
                
                if (!tree[d]) tree[d] = { chiefdoms: {} };
                if (!tree[d].chiefdoms[c]) tree[d].chiefdoms[c] = { 
                    name: c,
                    schools: []
                };
                
                const fullKey = d.toLowerCase()+'|'+c.toLowerCase()+'|'+p.toLowerCase()+'|'+com.toLowerCase()+'|'+sc.toLowerCase();
                tree[d].chiefdoms[c].schools.push({
                    name: sc,
                    phu: p,
                    community: com,
                    key: fullKey,
                    status: status,
                    submitted: isSubmitted(fullKey)
                });
            });
            return tree;
        }
        
        // Get current data based on filter
        let activeSchools, tree, filterLabel;
        if (currentFilter === 'old') {
            activeSchools = oldSchools;
            filterLabel = 'EMIS SCHOOLS ONLY';
        } else if (currentFilter === 'new') {
            activeSchools = newSchools;
            filterLabel = 'Non-EMIS SCHOOLS ONLY';
        } else {
            activeSchools = allSchools;
            filterLabel = 'ALL SCHOOLS';
        }
        
        tree = buildTreeFromSchools(activeSchools);
        const districts = Object.keys(tree).sort();
        
        if (!districts.length) {
            body.innerHTML = `<div class="an-no-data">
                <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                <div>No schools found with Status='${currentFilter.toUpperCase()}'. Check cascading_data.csv for 'School Status' column.</div>
            </div>`;
            return;
        }
        
        // Calculate totals for current filter
        let natTotal = 0, natSubmitted = 0;
        districts.forEach(d => {
            Object.keys(tree[d].chiefdoms).forEach(c => {
                natTotal += tree[d].chiefdoms[c].schools.length;
                natSubmitted += tree[d].chiefdoms[c].schools.filter(s => s.submitted).length;
            });
        });
        const natPct = natTotal > 0 ? Math.round((natSubmitted / natTotal) * 100) : 0;
        
        // Also calculate totals for other statuses to show in cards
        const oldTotal = oldSchools.length;
        const oldSubmitted = oldSchools.filter(s => {
            const d = (s['District'] || '').trim().toLowerCase();
            const c = (s['Chiefdom'] || '').trim().toLowerCase();
            const p = (s['Name of PHU'] || s['Facility'] || '').trim().toLowerCase();
            const com = (s['Community'] || '').trim().toLowerCase();
            const sc = (s['School Name'] || '').trim().toLowerCase();
            const key = d+'|'+c+'|'+p+'|'+com+'|'+sc;
            return submitted.has(key);
        }).length;
        const oldPct = oldTotal > 0 ? Math.round((oldSubmitted / oldTotal) * 100) : 0;
        
        const newTotal = newSchools.length;
        const newSubmitted = newSchools.filter(s => {
            const d = (s['District'] || '').trim().toLowerCase();
            const c = (s['Chiefdom'] || '').trim().toLowerCase();
            const p = (s['Name of PHU'] || s['Facility'] || '').trim().toLowerCase();
            const com = (s['Community'] || '').trim().toLowerCase();
            const sc = (s['School Name'] || '').trim().toLowerCase();
            const key = d+'|'+c+'|'+p+'|'+com+'|'+sc;
            return submitted.has(key);
        }).length;
        const newPct = newTotal > 0 ? Math.round((newSubmitted / newTotal) * 100) : 0;
        
        // Build HTML
        let html = `
        <style>
            .tg-kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:18px;}
            .tg-kpi{background:#fff;border-radius:10px;padding:14px 10px;text-align:center;box-shadow:0 2px 8px rgba(0,64,128,.07);border-top:4px solid #004080;cursor:pointer;transition:transform .2s, box-shadow .2s;}
            .tg-kpi:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,64,128,.15);}
            .tg-kpi.active{box-shadow:0 0 0 2px #fff, 0 0 0 4px #c8991a;}
            .tg-kpi.g{border-top-color:#28a745;} .tg-kpi.r{border-top-color:#dc3545;} .tg-kpi.o{border-top-color:#f0a500;} .tg-kpi.b{border-top-color:#004080;}
            .tg-kv{font-family:'Oswald',sans-serif;font-size:28px;font-weight:700;color:#004080;line-height:1;}
            .tg-kpi.g .tg-kv{color:#28a745;} .tg-kpi.r .tg-kv{color:#dc3545;} .tg-kpi.o .tg-kv{color:#b8860b;}
            .tg-kl{font-size:10px;color:#607080;text-transform:uppercase;letter-spacing:.5px;margin-top:5px;font-family:'Oswald',sans-serif;}
            .tg-nat-bar{height:14px;background:#e4eaf2;border-radius:7px;overflow:hidden;margin:10px 0 18px;}
            .tg-nat-fill{height:100%;border-radius:7px;transition:width .5s;}
            
            .tg-filter-bar{display:flex;gap:12px;margin-bottom:20px;padding:8px 12px;background:#f0f6ff;border-radius:12px;flex-wrap:wrap;}
            .tg-filter-btn{background:#fff;border:2px solid #c5d9f0;border-radius:30px;padding:8px 20px;font-family:'Oswald',sans-serif;font-size:11px;font-weight:600;letter-spacing:.5px;color:#004080;cursor:pointer;transition:all .2s;}
            .tg-filter-btn.active{background:#004080;border-color:#004080;color:#fff;}
            .tg-filter-btn:hover{background:#c5d9f0;}
            
            .tg-dist{background:#fff;border-radius:12px;box-shadow:0 2px 10px rgba(0,64,128,.08);overflow:hidden;margin-bottom:14px;border:2px solid #d0dce8;}
            .tg-dist-hdr{background:linear-gradient(135deg,#004080,#1a6abf);color:#fff;padding:12px 16px;display:flex;align-items:center;gap:10px;cursor:pointer;}
            .tg-dist-name{font-family:'Oswald',sans-serif;font-size:14px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;flex:1;}
            .tg-dist-badge{background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);border-radius:6px;padding:3px 10px;font-family:'Oswald',sans-serif;font-size:11px;white-space:nowrap;}
            .tg-dist-progress{height:4px;background:rgba(255,255,255,.25);}
            .tg-dist-progress-fill{height:100%;background:#c8991a;transition:width .4s;}
            
            .tg-chief-wrap{overflow-x:auto;padding:12px;}
            .tg-chief-tbl{width:100%;border-collapse:collapse;font-size:12px;}
            .tg-chief-tbl th{padding:9px 12px;font-family:'Oswald',sans-serif;font-size:10px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:#004080;text-align:left;border-bottom:2px solid #c5d9f0;background:#e8f1fa;}
            .tg-chief-tbl td{padding:8px 12px;border-bottom:1px solid #f0f4f8;vertical-align:middle;}
            .tg-chief-tbl tr:last-child td{border-bottom:none;}
            .tg-chief-tbl tr:nth-child(even) td{background:#fafcff;}
            
            .tg-prog-cell{display:flex;align-items:center;gap:8px;}
            .tg-prog-bar{background:#e4eaf2;border-radius:4px;height:8px;flex:1;overflow:hidden;min-width:60px;}
            .tg-prog-fill{height:100%;border-radius:4px;}
            .tg-school-chips{display:flex;flex-wrap:wrap;gap:4px;max-width:450px;}
            .tg-chip{display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;white-space:nowrap;}
            .tg-chip.done{background:#e8f5e9;color:#28a745;border:1px solid #b2dfcc;}
            .tg-chip.pend{background:#fff8e1;color:#b8860b;border:1px solid #ffe082;}
            .tg-chip.done-new{background:#e3f2fd;color:#1565c0;border:1px solid #90caf9;}
            .tg-chip.pend-new{background:#e8eaf6;color:#3949ab;border:1px solid #c5cae9;}
            .tg-phu-row{background:#f8fbff;}
            .tg-phu-label{background:#e8f1fb;color:#004080;padding:1px 7px;border-radius:10px;font-size:10px;font-weight:700;margin-right:8px;}
            .tg-status-badge{display:inline-block;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;margin-left:6px;}
            .tg-status-badge.old{background:#e0e0e0;color:#616161;}
            .tg-status-badge.new{background:#e3f2fd;color:#1565c0;}
        </style>
    
        <!-- Filter Bar -->
        <div class="tg-filter-bar">
            <button class="tg-filter-btn ${currentFilter === 'old' ? 'active' : ''}" onclick="setTargetsFilter('old')">EMIS SCHOOLS ONLY</button>
            <button class="tg-filter-btn ${currentFilter === 'new' ? 'active' : ''}" onclick="setTargetsFilter('new')">NON-EMIS SCHOOLS ONLY</button>
            <button class="tg-filter-btn ${currentFilter === 'all' ? 'active' : ''}" onclick="setTargetsFilter('all')">EMIS & NON-EMIS SCHOOLS</button>
        </div>
    
        <!-- Summary Cards -->
        <div class="tg-kpi-row">
            <div class="tg-kpi b" onclick="setTargetsFilter('old')">
                <div class="tg-kv">${oldTotal.toLocaleString()}</div>
                <div class="tg-kl">EMIS Schools</div>
                <div style="font-size:10px;margin-top:4px;">${oldSubmitted} submitted · ${oldPct}%</div>
            </div>
            <div class="tg-kpi" style="border-top-color:#1565c0;" onclick="setTargetsFilter('new')">
                <div class="tg-kv" style="color:#1565c0;">${newTotal.toLocaleString()}</div>
                <div class="tg-kl">Non-EMIS Schools</div>
                <div style="font-size:10px;margin-top:4px;">${newSubmitted} submitted · ${newPct}%</div>
            </div>
    
            <div class="tg-kpi g">
                <div class="tg-kv">${natSubmitted.toLocaleString()}</div>
                <div class="tg-kl">Submitted</div>
            </div>
            <div class="tg-kpi ${natPct>=80?'g':natPct>=50?'o':'r'}">
                <div class="tg-kv">${natPct}%</div>
                <div class="tg-kl">Progress</div>
            </div>
        </div>
    
        <div style="margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;font-family:'Oswald',sans-serif;font-size:11px;color:#607080;margin-bottom:5px;">
                <span>${filterLabel} — PROGRESS</span>
                <span style="font-weight:700;color:${natPct>=80?'#28a745':natPct>=50?'#b8860b':'#dc3545'}">${natSubmitted} / ${natTotal} schools (${natPct}%)</span>
            </div>
            <div class="tg-nat-bar">
                <div class="tg-nat-fill" style="width:${natPct}%;background:${natPct>=80?'#28a745':natPct>=50?'#f0a500':'#dc3545'};"></div>
            </div>
        </div>`;
    
        // Build district sections
        districts.forEach((district, di) => {
            const chiefdoms = Object.keys(tree[district].chiefdoms).sort();
            let dTotal = 0, dSubmitted = 0;
            chiefdoms.forEach(c => {
                dTotal += tree[district].chiefdoms[c].schools.length;
                dSubmitted += tree[district].chiefdoms[c].schools.filter(s => s.submitted).length;
            });
            const dPct = dTotal > 0 ? Math.round((dSubmitted / dTotal) * 100) : 0;
            const panelId = 'tg-panel-' + di;
    
            html += `
            <div class="tg-dist">
                <div class="tg-dist-hdr" onclick="document.getElementById('${panelId}').style.display = document.getElementById('${panelId}').style.display === 'none' ? 'block' : 'none'">
                    <span class="tg-dist-name">📍 ${district}</span>
                    <span class="tg-dist-badge">${chiefdoms.length} chiefdom${chiefdoms.length !== 1 ? 's' : ''}</span>
                    <span class="tg-dist-badge">${dTotal} schools</span>
                    <span class="tg-dist-badge" style="background:${dPct>=80?'rgba(40,167,69,.35)':dPct>=50?'rgba(240,165,0,.35)':'rgba(220,53,69,.35)'};">${dPct}%</span>
                    <span style="font-size:14px;">▼</span>
                </div>
                <div class="tg-dist-progress"><div class="tg-dist-progress-fill" style="width:${dPct}%;"></div></div>
                <div id="${panelId}" style="display:none;">
                    <div class="tg-chief-wrap">
                        <table class="tg-chief-tbl">
                            <thead>
                                <tr><th>Chiefdom / PHU</th><th style="text-align:center;">Target</th><th style="text-align:center;">Submitted</th><th style="text-align:center;">Remaining</th><th>Progress</th><th>Schools</th></tr>
                            </thead>
                            <tbody>`;
    
            chiefdoms.forEach(chiefdom => {
                const schools = tree[district].chiefdoms[chiefdom].schools;
                const cTotal = schools.length;
                const cSubmitted = schools.filter(s => s.submitted).length;
                const cPct = cTotal > 0 ? Math.round((cSubmitted / cTotal) * 100) : 0;
                const cCol = cPct >= 80 ? '#28a745' : cPct >= 50 ? '#f0a500' : '#dc3545';
                
                // Group by PHU
                const phuGroups = {};
                schools.forEach(s => {
                    if (!phuGroups[s.phu]) phuGroups[s.phu] = [];
                    phuGroups[s.phu].push(s);
                });
                const phus = Object.keys(phuGroups).sort();
                
                // Chiefdom summary row
                html += `<tr style="background:#f0f4f8;">
                    <td style="font-weight:700;color:#004080;">🏛️ ${chiefdom}</td>
                    <td style="text-align:center;font-weight:700;">${cTotal}</td>
                    <td style="text-align:center;font-weight:700;color:#28a745;">${cSubmitted}</td>
                    <td style="text-align:center;font-weight:700;color:${cTotal-cSubmitted>0?'#dc3545':'#28a745'};">${cTotal - cSubmitted}</td>
                    <td>
                        <div class="tg-prog-cell">
                            <div class="tg-prog-bar"><div class="tg-prog-fill" style="width:${cPct}%;background:${cCol};"></div></div>
                            <span style="font-size:11px;font-weight:700;color:${cCol};white-space:nowrap;">${cPct}%</span>
                        </div>
                    </td>
                    <td style="color:#607080;font-size:10px;">${phus.length} PHU${phus.length !== 1 ? 's' : ''}</td>
                </tr>`;
                
                // PHU rows
                phus.forEach(phu => {
                    const pSchools = phuGroups[phu];
                    const pTotal = pSchools.length;
                    const pSubmitted = pSchools.filter(s => s.submitted).length;
                    const pPct = pTotal > 0 ? Math.round((pSubmitted / pTotal) * 100) : 0;
                    const pCol = pPct >= 80 ? '#28a745' : pPct >= 50 ? '#f0a500' : '#dc3545';
                    
                    const schoolChips = pSchools.map(s => {
                        // Determine chip style based on status and submission
                        let chipClass, chipIcon;
                        if (s.status === 'New') {
                            if (s.submitted) {
                                chipClass = 'done-new';
                                chipIcon = '✓';
                            } else {
                                chipClass = 'pend-new';
                                chipIcon = '○';
                            }
                        } else {
                            if (s.submitted) {
                                chipClass = 'done';
                                chipIcon = '✓';
                            } else {
                                chipClass = 'pend';
                                chipIcon = '○';
                            }
                        }
                        return `<span class="tg-chip ${chipClass}" title="${s.community} - ${s.name} (${s.status})">${chipIcon} ${s.name.length > 25 ? s.name.substring(0,22)+'…' : s.name}</span>`;
                    }).join('');
                    
                    html += `<tr class="tg-phu-row">
                        <td style="padding-left:20px;">
                            <span class="tg-phu-label">PHU</span> ${phu}
                        </td>
                        <td style="text-align:center;font-size:11px;">${pTotal}</td>
                        <td style="text-align:center;font-size:11px;color:#28a745;font-weight:700;">${pSubmitted}</td>
                        <td style="text-align:center;font-size:11px;color:${pTotal-pSubmitted>0?'#dc3545':'#28a745'};font-weight:700;">${pTotal - pSubmitted}</td>
                        <td>
                            <div class="tg-prog-cell">
                                <div class="tg-prog-bar"><div class="tg-prog-fill" style="width:${pPct}%;background:${pCol};"></div></div>
                                <span style="font-size:10px;font-weight:700;color:${pCol};white-space:nowrap;">${pPct}%</span>
                            </div>
                        </td>
                        <td><div class="tg-school-chips">${schoolChips}</div></td>
                    </tr>`;
                });
            });
    
            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;
        });
    
        body.innerHTML = html;
    }
    
    // Filter setter function
    window.setTargetsFilter = function(filter) {
        const body = document.getElementById('targetsBody');
        if (body) {
            body.setAttribute('data-filter', filter);
            renderTargetsTab();
        }
    };
    // ════════════════════════════════════════════════════════
    //  OPEN/CLOSE ANALYSIS with CSV loading
    // ════════════════════════════════════════════════════════
    window.openAnalysisModal = async function(){
        const modal=document.getElementById('analysisModal');
        if(!modal)return;
        modal.classList.add('show');
        switchAnTab('analysis');
        initDistrictFilter();

        const body=document.getElementById('analysisBody');
        const sub=document.getElementById('anSubtitle');
        if(body)body.innerHTML=`<div class="an-loading"><div class="an-spinner"></div><div class="an-load-txt">Fetching data from ICF-SL Server…</div></div>`;
        if(sub)sub.textContent='Loading…';

        // Load CSV and filter by School Status = "Old"
        await parseSchoolStatusCSV();
        
        const sheetRows = await fetchSheetData();
        _sheetRows = sheetRows;
        window._TARGETS = buildTargetsFromCSV();
        runAnalysis(sheetRows);

        startAutoRefresh();
    };

    window.closeAnalysisModal=function(){
        stopAutoRefresh();
        destroyCharts();
        document.getElementById('analysisModal')?.classList.remove('show');
    };

    // ════════════════════════════════════════════════════════
    //  AUTO REFRESH
    // ════════════════════════════════════════════════════════
    function startAutoRefresh(){
        stopAutoRefresh();
        _refreshCountdown = 60;
        updateRefreshBtn();
        _refreshInterval = setInterval(async () => {
            _refreshCountdown--;
            updateRefreshBtn();
            if(_refreshCountdown <= 0){
                _refreshCountdown = 60;
                const rows = await fetchSheetData();
                _sheetRows = rows;
                window._TARGETS = buildTargetsFromCSV();
                runAnalysis(rows);
                const tBody = document.getElementById('targetsBody');
                if(tBody && tBody.style.display !== 'none') renderTargetsTab();
                console.log('[Analysis] Auto-refreshed at', new Date().toLocaleTimeString());
            }
        }, 1000);
    }

    function stopAutoRefresh(){
        if(_refreshInterval){ clearInterval(_refreshInterval); _refreshInterval = null; }
    }

    function updateRefreshBtn(){
        const btn = document.getElementById('anRefreshBtn');
        if(!btn) return;
        if(_refreshCountdown <= 0){
            btn.textContent = '↻ Refreshing…';
            btn.style.opacity = '0.6';
        } else {
            btn.textContent = `↻ REFRESH (${_refreshCountdown}s)`;
            btn.style.opacity = '1';
        }
    }

    window.anRefresh = async function(){
        const body=document.getElementById('analysisBody');
        if(body)body.innerHTML=`<div class="an-loading"><div class="an-spinner"></div><div class="an-load-txt">Refreshing from ICF-SL Server…</div></div>`;
        const btn=document.getElementById('anRefreshBtn');
        if(btn){btn.disabled=true;btn.textContent='↻ Loading…';}
        _refreshCountdown = 60;
        try {
            await parseSchoolStatusCSV();
            const rows = await fetchSheetData();
            _sheetRows = rows;
            window._TARGETS = buildTargetsFromCSV();
            runAnalysis(rows);
            const tBody = document.getElementById('targetsBody');
            if(tBody && tBody.style.display !== 'none') renderTargetsTab();
        } catch(e) {
            console.warn('[Refresh]',e);
            if(body)body.innerHTML=`<div class="an-no-data"><div style="margin-bottom:12px;">Could not load data — check connection and try again.</div><button onclick="anRefresh()" style="background:#004080;color:#fff;border:none;border-radius:8px;padding:9px 20px;font-family:'Oswald',sans-serif;font-size:12px;font-weight:600;cursor:pointer;">↻ RETRY</button></div>`;
        } finally {
            if(btn){btn.disabled=false;}
            updateRefreshBtn();
        }
    };

    // ════════════════════════════════════════════════════════
    //  AI STATS STRIP
    // ════════════════════════════════════════════════════════
    function statsHTML(sheetCount){
        const s=window.state||{};
        const sess=(s.submittedSchools||[]).length,pend=(s.pendingSubmissions||[]).length,drft=(s.drafts||[]).length;
        let tp=0,ti=0;
        [...(s.submittedSchools||[]).map(r=>r.data||r),...(s.pendingSubmissions||[])].forEach(r=>{tp+=+r.total_pupils||0;ti+=+r.total_itn||0;});
        const pct=tp>0?Math.round((ti/tp)*100):0;
        const sep='<div class="icf-ai-stat-div"></div>';
        return[`<div class="icf-ai-stat"><div class="icf-ai-stat-val">${sess}</div><div class="icf-ai-stat-lbl">Session</div></div>`,sep,`<div class="icf-ai-stat"><div class="icf-ai-stat-val" style="color:#28a745">${sheetCount!==null?sheetCount:'…'}</div><div class="icf-ai-stat-lbl">In Sheet</div></div>`,sep,`<div class="icf-ai-stat"><div class="icf-ai-stat-val" style="color:#e6a800">${pend}</div><div class="icf-ai-stat-lbl">Pending</div></div>`,sep,`<div class="icf-ai-stat"><div class="icf-ai-stat-val">${drft}</div><div class="icf-ai-stat-lbl">Drafts</div></div>`,sep,`<div class="icf-ai-stat"><div class="icf-ai-stat-val">${tp.toLocaleString()}</div><div class="icf-ai-stat-lbl">Pupils</div></div>`,sep,`<div class="icf-ai-stat"><div class="icf-ai-stat-val">${ti.toLocaleString()}</div><div class="icf-ai-stat-lbl">ITNs</div></div>`,sep,`<div class="icf-ai-stat"><div class="icf-ai-stat-val" style="color:${pct>=80?'#28a745':pct>=50?'#e6a800':'#dc3545'}">${pct}%</div><div class="icf-ai-stat-lbl">Coverage</div></div>`].join('');
    }

    window.icfAiRefreshStats=async function(){
        const el=document.getElementById('icfAiStats');if(el)el.innerHTML=statsHTML(null);
        setStatus('chk','Checking GAS…');
        const c=await fetchCount();
        if(el)el.innerHTML=statsHTML(c);
        setStatus(c==='?'?'err':'ok',c==='?'?'GAS unreachable':'GAS connected · '+c+' records');
    };

    let _statsTimer = null;
    function startStatsAutoRefresh(){
        if(_statsTimer) clearInterval(_statsTimer);
        _statsTimer = setInterval(async ()=>{
            if(document.hidden || !navigator.onLine) return;
            const c = await fetchCount();
            const el = document.getElementById('icfAiStats');
            if(el) el.innerHTML = statsHTML(c);
        }, 30000);
    }

    window.icfAiRefreshStats().then(()=>{ startStatsAutoRefresh(); }).catch(()=>{ startStatsAutoRefresh(); });

    const _origMarkSubmitted = window.markSchoolSubmitted;
    if(typeof _origMarkSubmitted === 'function'){
        window.markSchoolSubmitted = function(data){
            _origMarkSubmitted(data);
            setTimeout(()=>window.icfAiRefreshStats(), 1500);
        };
    }

    function setStatus(t,m){const el=document.getElementById('icfGasStatus');if(el)el.innerHTML=`<div class="icf-pill ${t}"><div class="icf-dot"></div>${m}</div>`;}

    // ════════════════════════════════════════════════════════
    //  AI CHAT
    // ════════════════════════════════════════════════════════
    let chatHist=[];

    function buildCtx(){
        try{
            const all=mergeData(_sheetRows);if(!all.length)return null;
            let tp=0,ti=0,tb=0,tg=0;const byDist={};
            all.forEach(r=>{const _p=n(r,'Total Pupils Enrolled','total_pupils'),_i=n(r,'Total ITNs Distributed','total_itn'),_b=n(r,'Total Boys Enrolled','total_boys'),_g=n(r,'Total Girls Enrolled','total_girls');tp+=_p;ti+=_i;tb+=_b;tg+=_g;const d=s(r,'district','District')||'Unknown';if(!byDist[d])byDist[d]={n:0,p:0,i:0};byDist[d].n++;byDist[d].p+=_p;byDist[d].i+=_i;});
            const ov=tp>0?Math.round((ti/tp)*100):0;
            let ctx=`=== ICF-SL ITN DATA ===\nSchools:${all.length}|Pupils:${tp}(${tb}B/${tg}G)|Distributed:${ti}|Coverage:${ov}%\nBY DISTRICT:\n`;
            Object.entries(byDist).forEach(([d,v])=>{ctx+=`  ${d}:${v.n} schools,${v.p} pupils,${v.p>0?Math.round((v.i/v.p)*100):0}% cov\n`;});
            ctx+=`SCHOOLS:\n`;
            all.slice(0,30).forEach((r,i)=>{const vp=+r.total_pupils||0,vi=+r.total_itn||0,cov=vp>0?Math.round((vi/vp)*100):0;ctx+=`[${i+1}] ${s(r,'school_name','School Name')||'—'}(${s(r,'community','Community / Village')||'—'},${s(r,'district','District')||'—'})P:${vp},ITN:${vi},Cov:${cov}%,by:${s(r,'submitted_by','Submitted By')||'—'}\n`;});
            return ctx;
        }catch{return null;}
    }

    function addMsg(role,text){
        const w=document.getElementById('icfAiMessages');if(!w)return;
        const d=document.createElement('div');d.className='icf-msg '+role;
        const isAI=role==='ai';
        d.innerHTML=`<div class="icf-msg-av">${isAI?'<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'}</div><div class="icf-bub"></div>`;
        w.appendChild(d);d.querySelector('.icf-bub').innerHTML=md(text);w.scrollTop=w.scrollHeight;
    }

    function showTyp(on){
        if(on){const w=document.getElementById('icfAiMessages');if(!w)return;const d=document.createElement('div');d.className='icf-msg ai';d.id='icfTyp';d.innerHTML='<div class="icf-msg-av"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></div><div class="icf-bub"><div class="icf-typing"><span></span><span></span><span></span></div></div>';w.appendChild(d);w.scrollTop=w.scrollHeight;}
        else{const e=document.getElementById('icfTyp');if(e)e.remove();}
    }

    function renderSamples(){
        const r=document.getElementById('icfSqRow');if(!r)return;
        r.innerHTML='';
        pickN(4).forEach(q=>{const b=document.createElement('button');b.className='icf-sq';b.textContent=q;b.onclick=()=>icfAiAskQ(q);r.appendChild(b);});
    }

    function icfAiAskQ(q){const i=document.getElementById('icfAiInput');if(i){i.value=q;icfAiAutoResize(i);}icfAiSend();}
    window.icfAiAskQuestion=icfAiAskQ;

    window.icfAiSend=async function(){
        const inp=document.getElementById('icfAiInput'),btn=document.getElementById('icfAiSend');
        if(!inp)return;const q=inp.value.trim();if(!q)return;
        inp.value='';icfAiAutoResize(inp);
        addMsg('user',q);chatHist.push({role:'user',content:q});
        showTyp(true);if(btn)btn.disabled=true;
        try{const r=await callGAS(q,chatHist,buildCtx());showTyp(false);addMsg('ai',r);chatHist.push({role:'assistant',content:r});renderSamples();}
        catch(e){showTyp(false);addMsg('ai',`⚠️ **Error:** ${e.message}`);}
        finally{if(btn)btn.disabled=false;if(inp)inp.focus();}
    };

    window.icfAiKeydown   =e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();icfAiSend();}};
    window.icfAiAutoResize=el=>{el.style.height='auto';el.style.height=Math.min(el.scrollHeight,110)+'px';};
    window.icfAiClearChat =function(){chatHist=[];const w=document.getElementById('icfAiMessages');if(w)w.innerHTML='<div class="icf-welcome"><div class="icf-welcome-icon">🔄</div><div class="icf-welcome-title">Chat cleared</div><div class="icf-welcome-body">Ask me anything about your ITN data.</div></div><div id="icfGasStatus"></div>';renderSamples();};

    window.icfAiOpen=function(){
        document.getElementById('icfAiOverlay').classList.add('show');
        const el=document.getElementById('icfAiStats');if(el)el.innerHTML=statsHTML(null);
        renderSamples();icfAiRefreshStats();
        setTimeout(()=>{const i=document.getElementById('icfAiInput');if(i)i.focus();},200);
    };
    window.icfAiClose       =()=>document.getElementById('icfAiOverlay').classList.remove('show');
    window.icfAiOverlayClick=e=>{if(e.target.id==='icfAiOverlay')icfAiClose();};
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){icfAiClose();closeAnalysisModal();}});

    // ════════════════════════════════════════════════════════
    //  DMS/PHU TAB — PHU delivery tracking from CSV + GAS
    // ════════════════════════════════════════════════════════
    async function renderDmsPhuTab() {
        const body = document.getElementById('dmsphuBody');
        if (!body) return;
        body.innerHTML = `<div style="text-align:center;padding:40px;">
            <div style="border:4px solid #e0e7ef;border-top:4px solid #004080;border-radius:50%;width:36px;height:36px;animation:spin 1s linear infinite;margin:0 auto 12px;"></div>
            <div style="font-family:Oswald,sans-serif;font-size:13px;color:#607080;letter-spacing:.5px;">Loading PHU delivery data…</div>
        </div>`;

        try {
            const lc = v => String(v||'').trim().toLowerCase();
            const key = (d,c,f) => lc(d)+'|'+lc(c)+'|'+lc(f);

            const csvTree = {};
            await new Promise(resolve => {
                Papa.parse('./dms_cascading.csv', {
                    download:true, header:true, skipEmptyLines:true,
                    complete(res) {
                        (res.data||[]).forEach(row => {
                            let d = (row['District']||row['district']||'').trim().replace(/\s*District\s*$/i,'').trim();
                            let c = (row['Chiefdom']||row['chiefdom']||'').trim().replace(/\s*Chiefdom\s*$/i,'').trim();
                            const f = (row['Facility']||row['facility']||row['Name of PHU']||row['hf']||'').trim();
                            if (!d||!c||!f) return;
                            if (!csvTree[d]) csvTree[d]={};
                            if (!csvTree[d][c]) csvTree[d][c]=[];
                            if (!csvTree[d][c].includes(f)) csvTree[d][c].push(f);
                        });
                        console.log('[DMS/PHU] csvTree loaded:', Object.keys(csvTree).length, 'districts');
                        resolve();
                    },
                    error(){ resolve(); }
                });
            });

            if (!Object.keys(csvTree).length) {
                body.innerHTML='<div style="padding:24px;font-family:Oswald,sans-serif;color:#607080;font-size:13px;text-align:center;">No location data — ensure dms_cascading.csv is in the repo</div>';
                return;
            }

            const gasUrl = 'https://script.google.com/macros/s/AKfycbymRy-M5v0fVLWUjw4IXYhd1oIR2ZvnP_Dzr_iGR-Th0cMIpmE2ntGeujWYH7-C6NHIzA/exec';

            const parseArr = d => Array.isArray(d) ? d : (Array.isArray(d?.rows) ? d.rows : (Array.isArray(d?.data) ? d.data : []));

            const [dispRaw, recRaw] = await Promise.allSettled([
                fetch(gasUrl + '?action=getAllDispatches').then(r=>r.json()).catch(()=>[]),
                fetch(gasUrl + '?action=getAllReceipts').then(r=>r.json()).catch(()=>[])
            ]);

            const dispatched = parseArr(dispRaw.status==='fulfilled' ? dispRaw.value : []);
            const received   = parseArr(recRaw.status==='fulfilled'  ? recRaw.value  : []);

            const dispSet    = new Set(dispatched.map(d => key(d.district, d.chiefdom, d.phu)));
            const dispPhuOnly= new Set(dispatched.map(d => lc(d.phu)));
            const recSet     = new Set(received.map(r  => key(r.district, r.chiefdom, r.phu)));
            const recPhuOnly = new Set(received.map(r  => lc(r.phu)));

            function isDispatched(d,c,f){ return dispSet.has(key(d,c,f)) || dispPhuOnly.has(lc(f)); }
            function isReceived(d,c,f){   return recSet.has(key(d,c,f))  || recPhuOnly.has(lc(f));  }

            let totTotal=0, totReceived=0, totPending=0, totNot=0;
            Object.keys(csvTree).forEach(district => {
                Object.keys(csvTree[district]).forEach(chiefdom => {
                    csvTree[district][chiefdom].forEach(phu => {
                        totTotal++;
                        if (isDispatched(district,chiefdom,phu) && isReceived(district,chiefdom,phu)) totReceived++;
                        else if (isDispatched(district,chiefdom,phu)) totPending++;
                        else totNot++;
                    });
                });
            });

            const pct = totTotal ? Math.round(totReceived/totTotal*100) : 0;

            let html = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
                ${dmsCard('Total PHUs', totTotal, '#004080')}
                ${dmsCard('Received ✅', totReceived, '#28a745')}
                ${dmsCard('Pending ⏳', totPending, '#f59e0b')}
                ${dmsCard('Not Started 🔴', totNot, '#dc3545')}
            </div>
            <div style="background:#fff;border-radius:12px;padding:14px 16px;margin-bottom:16px;box-shadow:0 2px 10px rgba(0,0,0,.05);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-family:Oswald,sans-serif;font-size:11px;color:#607080;letter-spacing:1px;text-transform:uppercase;">Overall Delivery Progress</span>
                    <span style="font-family:Oswald,sans-serif;font-size:20px;font-weight:700;color:#004080;">${pct}%</span>
                </div>
                <div style="height:10px;background:#e8f0f8;border-radius:6px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#004080,#28a745);border-radius:6px;"></div>
                </div>
                <div style="display:flex;gap:16px;margin-top:8px;font-size:10px;color:#94a3b8;">
                    <span style="color:#28a745;font-weight:700;">${totReceived} received</span>
                    <span style="color:#f59e0b;font-weight:700;">${totPending} pending</span>
                    <span style="color:#dc3545;font-weight:700;">${totNot} not started</span>
                </div>
            </div>`;

            Object.keys(csvTree).sort().forEach(district => {
                const duid = 'dist_' + district.replace(/\s+/g,'_').replace(/[^a-z0-9_]/gi,'');
                let dRec=0,dPend=0,dNot=0,dTotal=0;
                Object.keys(csvTree[district]).forEach(chiefdom => {
                    csvTree[district][chiefdom].forEach(phu => {
                        dTotal++;
                        if(isDispatched(district,chiefdom,phu)&&isReceived(district,chiefdom,phu))dRec++;
                        else if(isDispatched(district,chiefdom,phu))dPend++; else dNot++;
                    });
                });
                const dPct = dTotal ? Math.round(dRec/dTotal*100) : 0;
                const dBorder = dRec===dTotal?'#28a745':dPend>0?'#f59e0b':'#e2e8f0';

                html += `<div style="background:#fff;border-radius:14px;box-shadow:0 3px 14px rgba(0,64,128,.08);margin-bottom:12px;margin-top:16px;overflow:hidden;">
                    <div style="background:linear-gradient(135deg,#002952,#004080);padding:13px 16px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;border-left:5px solid ${dBorder};"
                        onclick="var el=document.getElementById('${duid}');var arr=document.getElementById('${duid}_arr');el.style.display=el.style.display==='none'?'block':'none';arr.textContent=el.style.display==='none'?'▶':'▼';">
                        <div>
                            <div style="font-family:Oswald,sans-serif;font-size:15px;color:#ffc107;letter-spacing:1.5px;">📍 ${district.toUpperCase()}</div>
                            <div style="font-size:10px;color:rgba(255,255,255,.55);margin-top:2px;">${dTotal} PHUs · <span style="color:#6ee7b7;">${dRec} received</span> · <span style="color:#fde68a;">${dPend} pending</span> · <span style="color:#fca5a5;">${dNot} not started</span></div>
                        </div>
                        <div style="text-align:right;display:flex;align-items:center;gap:10px;">
                            <div>
                                <div style="font-family:Oswald,sans-serif;font-size:20px;font-weight:700;color:#ffc107;">${dPct}%</div>
                                <div style="height:4px;width:60px;background:rgba(255,255,255,.2);border-radius:3px;margin-top:3px;"><div style="height:100%;width:${dPct}%;background:#ffc107;border-radius:3px;"></div></div>
                            </div>
                            <span id="${duid}_arr" style="color:#ffc107;font-size:14px;">▶</span>
                        </div>
                    </div>
                    <div id="${duid}" style="display:none;padding:12px;">`;

                Object.keys(csvTree[district]).sort().forEach(chiefdom => {
                    const phus = csvTree[district][chiefdom];
                    let cRec=0,cPend=0,cNot=0;
                    phus.forEach(phu=>{ if(isDispatched(district,chiefdom,phu)&&isReceived(district,chiefdom,phu))cRec++; else if(isDispatched(district,chiefdom,phu))cPend++; else cNot++; });
                    const cPct = phus.length ? Math.round(cRec/phus.length*100) : 0;
                    const borderColor = cRec===phus.length ? '#28a745' : cPend>0 ? '#f59e0b' : '#e2e8f0';
                    const uid = 'ch_' + Math.random().toString(36).slice(2,8);

                    html += `<div style="background:#fff;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,.05);margin-bottom:10px;overflow:hidden;">
                        <div style="padding:12px 16px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;border-left:4px solid ${borderColor};"
                            onclick="var el=document.getElementById('${uid}');el.style.display=el.style.display==='none'?'block':'none';">
                            <div>
                                <div style="font-family:Oswald,sans-serif;font-size:14px;color:#0f172a;letter-spacing:.5px;">${chiefdom}</div>
                                <div style="font-size:10px;color:#94a3b8;margin-top:2px;">${phus.length} PHUs · <span style="color:#28a745;">${cRec} received</span> · <span style="color:#f59e0b;">${cPend} pending</span> · <span style="color:#dc3545;">${cNot} not started</span></div>
                            </div>
                            <div style="text-align:right;flex-shrink:0;margin-left:10px;">
                                <div style="font-family:Oswald,sans-serif;font-size:18px;font-weight:700;color:#004080;">${cPct}%</div>
                                <div style="height:4px;width:56px;background:#e8f0f8;border-radius:3px;margin-top:3px;"><div style="height:100%;width:${cPct}%;background:#28a745;border-radius:3px;"></div></div>
                            </div>
                        </div>
                        <div id="${uid}" style="display:none;padding:10px 16px 12px;">
                            ${phus.map(phu => {
                                const wasD=isDispatched(district,chiefdom,phu), wasR=isReceived(district,chiefdom,phu);
                                let icon,label,bg,textColor;
                                if (wasD&&wasR)    { icon='✅'; label='Received';    bg='#e8f5e9'; textColor='#1e7a34'; }
                                else if (wasD)     { icon='⏳'; label='Pending';     bg='#fffbeb'; textColor='#92400e'; }
                                else               { icon='🔴'; label='Not Started'; bg='#fff1f1'; textColor='#b91c1c'; }
                                return `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:${bg};border-radius:8px;margin-bottom:5px;">
                                    <span style="font-size:12px;font-weight:500;color:#0f172a;">${icon} ${phu}</span>
                                    <span style="font-size:10px;font-weight:700;color:${textColor};">${label}</span>
                                </div>`;
                            }).join('')}
                        </div>
                    </div>`;
                });
                html += `</div></div>`;
            });

            body.innerHTML = html;

        } catch(err) {
            body.innerHTML = `<div style="padding:24px;font-family:Oswald,sans-serif;color:#dc3545;font-size:13px;">Error: ${err.message}</div>`;
        }
    }

    function dmsCard(label, val, color) {
        return `<div style="background:#fff;border-radius:12px;padding:14px;box-shadow:0 2px 10px rgba(0,0,0,.05);border-top:4px solid ${color};">
            <div style="font-family:Oswald,sans-serif;font-size:28px;font-weight:700;color:${color};">${val}</div>
            <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:#94a3b8;text-transform:uppercase;margin-top:4px;">${label}</div>
        </div>`;
    }

    console.log('[ICF AI Agent] Loaded with School Status filtering ✓');
})();
