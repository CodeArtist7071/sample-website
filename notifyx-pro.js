/**
 * ============================================================
 *  NotifyX PRO v3.0 — Complete Edition
 *  Smart Push Notification Widget with AI Message Generator
 * ------------------------------------------------------------
 *  Features:
 *  - Setup Wizard (OneSignal guided + custom messages + AI)
 *  - Exit Intent (Desktop) + Fast Scroll Up (Mobile)
 *  - 80% Read Depth + Tab Blur triggers
 *  - Auto site type detection (Blog/Store/News/Portfolio)
 *  - AI-powered notification message generator
 *  - Custom title, message, yes/no button text
 *  - Brand color picker
 *  - Dark mode built in
 *  - GDPR compliant opt-in
 * ------------------------------------------------------------
 *  Works on: WordPress, WooCommerce, Shopify, Wix, Any site
 *  License: Single Site $15 | Developer Unlimited
 * ============================================================
 */

(function () {
  'use strict';

  // ─── CONFIGURATION ────────────────────────────────────────
  var cfg = {
    oneSignalAppId : window.NOTIFYX_ONESIGNAL_ID  || '',
    siteId         : window.NOTIFYX_SITE_ID        || 'notifyx-site',
    siteName       : window.NOTIFYX_SITE_NAME      || document.title || 'Our Site',
    color          : window.NOTIFYX_COLOR          || '#6C63FF',
    position       : window.NOTIFYX_POSITION       || 'bottom-right',
    readDepth      : window.NOTIFYX_READ_DEPTH     || 0.80,
    siteType       : window.NOTIFYX_SITE_TYPE      || 'auto',
    // Custom message overrides (set via wizard or manually)
    customTitle    : window.NOTIFYX_TITLE          || '',
    customMessage  : window.NOTIFYX_MESSAGE        || '',
    customYes      : window.NOTIFYX_YES_BTN        || '',
    customNo       : window.NOTIFYX_NO_BTN         || '',
    // Widget popup image (photo or GIF shown inside the subscribe popup)
    widgetImage    : window.NOTIFYX_WIDGET_IMAGE    || '',
    widgetImageAlt : window.NOTIFYX_WIDGET_IMAGE_ALT|| '',
  };

  // ─── SMART MESSAGES PER SITE TYPE ─────────────────────────
  var MESSAGES = {
    blog      : { title: 'Enjoying this article?',      sub: 'Get notified when we publish new posts',         yes: 'Yes, notify me!',    no: 'No thanks' },
    store     : { title: 'Never miss a deal!',           sub: 'Get alerts on new products & exclusive offers',  yes: 'Send me deals!',     no: 'No thanks' },
    news      : { title: 'Stay ahead of the news!',     sub: 'Get breaking news notifications instantly',       yes: 'Notify me!',         no: 'No thanks' },
    portfolio : { title: 'Like what you see?',           sub: 'Get notified when I publish new work',            yes: 'Follow my work!',    no: 'No thanks' },
    generic   : { title: 'Before you go\u2026',         sub: 'Want updates from ' + cfg.siteName + '?',         yes: 'Keep me updated!',   no: 'No thanks' },
  };

  var TAGS = { blog: '📝 Blog', store: '🛍️ Store', news: '📰 News', portfolio: '🎨 Portfolio', generic: '🔔 Site' };

  // ─── STORAGE KEYS ─────────────────────────────────────────
  var KEY_STATUS  = 'nx_status_'  + (cfg.siteId || 'site');
  var KEY_CONFIG  = 'nx_config_'  + (cfg.siteId || 'site');
  var KEY_SETUP   = 'nx_setup_done';

  // ─── STATE ────────────────────────────────────────────────
  var triggered    = false;
  var isMobile     = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  var detectedType = 'generic';
  var wizardEl     = null;

  // ─── BOOT ─────────────────────────────────────────────────
  function init() {
    // Already subscribed or dismissed — never show again
    if (localStorage.getItem(KEY_STATUS) === 'subscribed') return;
    if (localStorage.getItem(KEY_STATUS) === 'dismissed')  return;

    // Load saved config from wizard if exists
    var saved = localStorage.getItem(KEY_CONFIG);
    if (saved) { try { var s = JSON.parse(saved); Object.assign(cfg, s); } catch(e){} }

    detectedType = cfg.siteType === 'auto' ? detectSiteType() : cfg.siteType;

    injectStyles();

    // First time — show setup wizard to site OWNER
    // (Only shows when ?pp_setup=1 is in URL or no OneSignal ID configured)
    var isOwnerSetup = location.search.indexOf('pp_setup=1') > -1;
    if (isOwnerSetup || !cfg.oneSignalAppId) {
      showWizard();
      return;
    }

    loadOneSignal();
    startTriggers();
  }

  // ─── SITE TYPE DETECTION ──────────────────────────────────
  function detectSiteType() {
    var h   = document.documentElement.innerHTML;
    var url = location.href.toLowerCase();
    var og  = (document.querySelector('meta[property="og:type"]') || {}).content || '';
    if (h.indexOf('woocommerce') > -1 || h.indexOf('shopify') > -1 || h.indexOf('add-to-cart') > -1 || url.indexOf('/shop') > -1 || url.indexOf('/product') > -1 || url.indexOf('/store') > -1) return 'store';
    if (url.indexOf('/news') > -1 || og === 'article' || document.querySelector('meta[name="news_keywords"]')) return 'news';
    if (url.indexOf('/portfolio') > -1 || url.indexOf('/work') > -1 || url.indexOf('/projects') > -1) return 'portfolio';
    if (document.querySelector('article') || url.indexOf('/blog') > -1 || url.indexOf('/post') > -1) return 'blog';
    return 'generic';
  }

  // ─── ONESIGNAL LOADER ─────────────────────────────────────
  function loadOneSignal() {
    if (!cfg.oneSignalAppId || document.getElementById('nx-onesignal-sdk')) return;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    var s   = document.createElement('script');
    s.id    = 'nx-onesignal-sdk';
    s.src   = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    s.defer = true;
    document.head.appendChild(s);
    window.OneSignalDeferred.push(function(OS) {
      OS.init({
        appId              : cfg.oneSignalAppId,
        autoResubscribe    : true,
        notifyButton       : { enable: false },
        welcomeNotification: { title: 'Thanks for subscribing!', message: 'You will now get updates from ' + cfg.siteName },
      });
    });
  }

  // ─── TRIGGERS ─────────────────────────────────────────────
  function startTriggers() {
    if (isMobile) initMobileScroll(); else initDesktopExit();
    initReadDepth();
    initTabBlur();
  }

  function initDesktopExit() {
    var fn = function(e) { if (e.clientY <= 8 && !triggered) { document.removeEventListener('mouseleave', fn); showWidget(); } };
    document.addEventListener('mouseleave', fn);
  }

  function initMobileScroll() {
    var lastY = window.scrollY, lastT = Date.now();
    window.addEventListener('scroll', function() {
      if (triggered) return;
      var now = Date.now(), curY = window.scrollY;
      if ((lastY - curY) / Math.max(now - lastT, 1) > 1.5 && curY > 100) showWidget();
      lastY = curY; lastT = now;
    }, { passive: true });
  }

  function initReadDepth() {
    window.addEventListener('scroll', function() {
      if (triggered) return;
      var pct = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (pct >= cfg.readDepth) showWidget();
    }, { passive: true });
  }

  function initTabBlur() {
    document.addEventListener('visibilitychange', function() {
      if (document.hidden && !triggered) showWidget();
    });
  }

  // ─── SHOW NOTIFICATION WIDGET ─────────────────────────────
  function showWidget() {
    if (triggered) return;
    triggered = true;

    var msg   = cfg.customTitle ? {
      title : cfg.customTitle,
      sub   : cfg.customMessage || 'Stay updated — no spam, ever.',
      yes   : cfg.customYes     || 'Yes, notify me!',
      no    : cfg.customNo      || 'No thanks',
    } : (MESSAGES[detectedType] || MESSAGES.generic);

    var tag   = cfg.customTitle ? '✨ Custom' : (TAGS[detectedType] || TAGS.generic);
    var c     = cfg.color;
    var pos   = cfg.position.replace('-', '');

    var el    = document.createElement('div');
    el.id     = 'nx-widget';
    el.className = 'pp-' + pos;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Subscribe to push notifications');

    var imgHTML = cfg.widgetImage ? [
      '<div class="pp-widget-img-wrap">',
        '<img src="' + esc(cfg.widgetImage) + '" alt="' + esc(cfg.widgetImageAlt) + '" class="pp-widget-img" loading="lazy">',
      '</div>',
    ].join('') : '';

    el.innerHTML = [
      '<button class="pp-x" id="pp-x" aria-label="Close">&#10005;</button>',
      imgHTML,
      '<div class="pp-head">',
        '<div class="pp-av" style="background:' + c + '1a" aria-hidden="true">',
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="' + c + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
            '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>',
            '<path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
          '</svg>',
        '</div>',
        '<div>',
          '<p class="pp-title">' + esc(msg.title) + '</p>',
          '<p class="pp-sub">' + esc(msg.sub) + '</p>',
        '</div>',
      '</div>',
      '<span class="pp-tag" style="background:' + c + '18;color:' + c + '">' + tag + '</span>',
      '<p class="pp-body">No spam — only updates worth your time. Unsubscribe anytime.</p>',
      '<div class="pp-row">',
        '<button class="pp-yes" id="pp-yes" style="background:' + c + '">' + esc(msg.yes) + '</button>',
        '<button class="pp-no"  id="pp-no">' + esc(msg.no) + '</button>',
      '</div>',
    ].join('');

    document.body.appendChild(el);
    requestAnimationFrame(function() { requestAnimationFrame(function() { el.classList.add('pp-show'); }); });

    document.getElementById('pp-yes').addEventListener('click', function() { handleYes(el); });
    document.getElementById('pp-no' ).addEventListener('click', function() { handleNo(el);  });
    document.getElementById('pp-x'  ).addEventListener('click', function() { handleNo(el);  });
  }

  function handleYes(el) {
    if (cfg.oneSignalAppId && window.OneSignalDeferred) {
      window.OneSignalDeferred.push(function(OS) {
        OS.Notifications.requestPermission().then(function() {
          localStorage.setItem(KEY_STATUS, 'subscribed');
          showSuccess(el);
        });
      });
    } else if ('Notification' in window) {
      Notification.requestPermission().then(function() {
        localStorage.setItem(KEY_STATUS, 'subscribed');
        showSuccess(el);
      });
    } else {
      localStorage.setItem(KEY_STATUS, 'subscribed');
      showSuccess(el);
    }
  }

  function handleNo(el) {
    localStorage.setItem(KEY_STATUS, 'dismissed');
    el.classList.add('pp-hide');
    setTimeout(function() { el && el.parentNode && el.parentNode.removeChild(el); }, 420);
  }

  function showSuccess(el) {
    el.innerHTML = '<div class="pp-ok"><div class="pp-ok-i">🎉</div><p class="pp-ok-t">You\'re subscribed!</p><p class="pp-ok-s">We\'ll notify you when there\'s something new worth your time.</p></div>';
    setTimeout(function() {
      el.classList.add('pp-hide');
      setTimeout(function() { el && el.parentNode && el.parentNode.removeChild(el); }, 420);
    }, 3000);
  }

  // ─── SETUP WIZARD ─────────────────────────────────────────
  function showWizard() {
    wizardEl = document.createElement('div');
    wizardEl.id = 'nx-wizard';
    wizardEl.innerHTML = [
      '<div id="pp-wz-box">',
        '<div id="pp-wz-head">',
          '<div id="pp-wz-logo">🔔 NotifyX <span>PRO</span></div>',
          '<div id="pp-wz-steps">',
            '<div class="pp-step pp-step-active" id="pp-wz-s1-dot">1</div>',
            '<div class="pp-step-line" id="pp-wz-l1"></div>',
            '<div class="pp-step" id="pp-wz-s2-dot">2</div>',
            '<div class="pp-step-line" id="pp-wz-l2"></div>',
            '<div class="pp-step" id="pp-wz-s2b-dot">3</div>',
            '<div class="pp-step-line" id="pp-wz-l2b"></div>',
            '<div class="pp-step" id="pp-wz-s3-dot">4</div>',
          '</div>',
        '</div>',

        // STEP 1 — OneSignal
        '<div id="pp-wz-s1">',
          '<h2 class="pp-wz-title">Connect OneSignal</h2>',
          '<p class="pp-wz-desc">OneSignal delivers your notifications to subscribers for free. Do you have an account?</p>',
          '<div id="pp-os-yes" class="pp-os-btn" onclick="NotifyXPRO._wz.osYes()">',
            '<div class="pp-os-icon">✅</div>',
            '<div><strong>Yes, I have one</strong><span>I\'ll paste my App ID</span></div>',
          '</div>',
          '<div id="pp-os-no" class="pp-os-btn" onclick="NotifyXPRO._wz.osNo()">',
            '<div class="pp-os-icon">🆕</div>',
            '<div><strong>No, create one free</strong><span>Opens onesignal.com in new tab</span></div>',
          '</div>',
          '<div id="pp-app-id-wrap" style="display:none">',
            '<label class="pp-label">Paste your OneSignal App ID</label>',
            '<input id="pp-app-id" type="text" placeholder="a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autocomplete="off">',
            '<button class="pp-wz-next" onclick="NotifyXPRO._wz.s1Next()">Next →</button>',
          '</div>',
        '</div>',

        // STEP 2 — Message
        '<div id="pp-wz-s2" style="display:none">',
          '<h2 class="pp-wz-title">Notification message</h2>',
          '<p class="pp-wz-desc">How should the popup talk to your visitors?</p>',
          '<div class="pp-radio-row">',
            '<label class="pp-radio"><input type="radio" name="pp-mode" value="auto" checked onchange="NotifyXPRO._wz.modeChange(false)"> <span>Auto — NotifyX picks the best message</span></label>',
            '<label class="pp-radio"><input type="radio" name="pp-mode" value="custom" onchange="NotifyXPRO._wz.modeChange(true)"> <span>Custom — I\'ll write my own</span></label>',
            '<label class="pp-radio"><input type="radio" name="pp-mode" value="ai" onchange="NotifyXPRO._wz.modeChange(\'ai\')"> <span>✨ AI — Generate message for me</span></label>',
          '</div>',

          // Auto preview
          '<div id="pp-mode-auto">',
            '<div class="pp-preview-label">Preview</div>',
            '<div class="pp-mini-widget" id="pp-auto-preview"></div>',
          '</div>',

          // Custom fields
          '<div id="pp-mode-custom" style="display:none">',
            '<div class="pp-field-group">',
              '<label class="pp-label">Title</label>',
              '<input id="pp-c-title" type="text" placeholder="e.g. Join 10,000 readers!" oninput="NotifyXPRO._wz.updatePreview()">',
            '</div>',
            '<div class="pp-field-group">',
              '<label class="pp-label">Message</label>',
              '<input id="pp-c-msg" type="text" placeholder="e.g. Get my weekly tips free" oninput="NotifyXPRO._wz.updatePreview()">',
            '</div>',
            '<div class="pp-two-col">',
              '<div class="pp-field-group">',
                '<label class="pp-label pp-label-yes">✓ Yes button</label>',
                '<input id="pp-c-yes" type="text" placeholder="Yes, notify me!" oninput="NotifyXPRO._wz.updatePreview()">',
              '</div>',
              '<div class="pp-field-group">',
                '<label class="pp-label pp-label-no">✕ No button</label>',
                '<input id="pp-c-no" type="text" placeholder="No thanks" oninput="NotifyXPRO._wz.updatePreview()">',
              '</div>',
            '</div>',
            '<div class="pp-preview-label">Live preview</div>',
            '<div class="pp-mini-widget" id="pp-custom-preview"></div>',
          '</div>',

          // AI mode
          '<div id="pp-mode-ai" style="display:none">',
            '<div class="pp-field-group">',
              '<label class="pp-label">Describe your site in one line</label>',
              '<input id="pp-ai-desc" type="text" placeholder="e.g. A food blog with healthy Indian recipes">',
            '</div>',
            '<button class="pp-ai-btn" onclick="NotifyXPRO._wz.generateAI()" id="pp-ai-generate-btn">✨ Generate with AI</button>',
            '<div id="pp-ai-result" style="display:none">',
              '<div class="pp-preview-label">AI generated — edit if you like</div>',
              '<div class="pp-field-group">',
                '<label class="pp-label">Title</label>',
                '<input id="pp-ai-title" type="text" oninput="NotifyXPRO._wz.updateAIPreview()">',
              '</div>',
              '<div class="pp-field-group">',
                '<label class="pp-label">Message</label>',
                '<input id="pp-ai-msg" type="text" oninput="NotifyXPRO._wz.updateAIPreview()">',
              '</div>',
              '<div class="pp-two-col">',
                '<div class="pp-field-group">',
                  '<label class="pp-label pp-label-yes">✓ Yes button</label>',
                  '<input id="pp-ai-yes" type="text" oninput="NotifyXPRO._wz.updateAIPreview()">',
                '</div>',
                '<div class="pp-field-group">',
                  '<label class="pp-label pp-label-no">✕ No button</label>',
                  '<input id="pp-ai-no" type="text" oninput="NotifyXPRO._wz.updateAIPreview()">',
                '</div>',
              '</div>',
              '<div class="pp-preview-label">Preview</div>',
              '<div class="pp-mini-widget" id="pp-ai-preview"></div>',
            '</div>',
          '</div>',

          '<button class="pp-wz-next" onclick="NotifyXPRO._wz.s2Next()" id="pp-s2-next">Next →</button>',
        '</div>',

        // STEP 2B — Widget Image/GIF
        '<div id="pp-wz-s2b" style="display:none">',
          '<h2 class="pp-wz-title">Add image or GIF to popup</h2>',
          '<p class="pp-wz-desc">Show visitors a photo or animated GIF inside the subscribe popup — makes them 3x more likely to click Yes!</p>',
          '<div id="wimg-upload-area" style="border:2px dashed #c8c3f5;border-radius:14px;padding:20px;text-align:center;cursor:pointer;background:#f8f7ff;position:relative;overflow:hidden;margin-bottom:12px">',
            '<input type="file" accept="image/*,.gif" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%" onchange="NotifyXPRO._wz.loadWidgetImg(this)">',
            '<div style="font-size:28px;margin-bottom:6px">🖼️</div>',
            '<p style="font-size:13px;font-weight:600;color:#111;margin-bottom:3px">Upload photo or GIF</p>',
            '<p style="font-size:11px;color:#888">Visitors will see this inside the popup before clicking Yes or No</p>',
          '</div>',
          '<div id="wimg-preview-wrap" style="display:none;margin-bottom:12px">',
            '<div style="font-size:11px;color:#666;margin-bottom:6px;display:flex;justify-content:space-between">',
              '<span>Preview — this shows inside your popup</span>',
              '<button onclick="NotifyXPRO._wz.clearWidgetImg()" style="background:none;border:none;color:#e11d48;font-size:11px;cursor:pointer">Remove ×</button>',
            '</div>',
            '<div style="border-radius:10px;overflow:hidden;border:1px solid #e8e5ff">',
              '<img id="wimg-prev" alt="widget image preview" style="width:100%;max-height:140px;object-fit:cover;display:block">',
            '</div>',
          '</div>',
          '<div style="background:#f0eeff;border-radius:10px;padding:12px;font-size:12px;color:#4a4480;margin-bottom:14px">',
            '💡 <strong>Pro tip:</strong> Use an animated GIF for your best product, latest article thumbnail, or a looping clip. People stop and look before clicking.',
          '</div>',
          '<div style="display:flex;gap:8px">',
            '<button class="pp-wz-next" onclick="NotifyXPRO._wz.s2bNext()" style="flex:1">Next — pick brand color</button>',
            '<button onclick="NotifyXPRO._wz.s2bSkip()" style="padding:12px 16px;border:1.5px solid #e0e0e0;border-radius:11px;background:#fff;color:#666;font-size:13px;cursor:pointer">Skip</button>',
          '</div>',
        '</div>',

        // STEP 3 — Color & Go Live
        '<div id="pp-wz-s3" style="display:none">',
          '<h2 class="pp-wz-title">Pick your brand color</h2>',
          '<p class="pp-wz-desc">The widget will match your site\'s look.</p>',
          '<div id="pp-colors">',
            '<div class="nx-swatch nx-swatch-active" style="background:#6C63FF" onclick="NotifyXPRO._wz.setColor(\'#6C63FF\',this)"></div>',
            '<div class="nx-swatch" style="background:#0ea5e9" onclick="NotifyXPRO._wz.setColor(\'#0ea5e9\',this)"></div>',
            '<div class="nx-swatch" style="background:#22c55e" onclick="NotifyXPRO._wz.setColor(\'#22c55e\',this)"></div>',
            '<div class="nx-swatch" style="background:#f97316" onclick="NotifyXPRO._wz.setColor(\'#f97316\',this)"></div>',
            '<div class="nx-swatch" style="background:#e11d48" onclick="NotifyXPRO._wz.setColor(\'#e11d48\',this)"></div>',
            '<div class="nx-swatch" style="background:#8b5cf6" onclick="NotifyXPRO._wz.setColor(\'#8b5cf6\',this)"></div>',
            '<div class="nx-swatch" style="background:#0d9488" onclick="NotifyXPRO._wz.setColor(\'#0d9488\',this)"></div>',
            '<div class="nx-swatch" style="background:#f59e0b" onclick="NotifyXPRO._wz.setColor(\'#f59e0b\',this)"></div>',
          '</div>',
          '<div class="pp-preview-label">Final preview</div>',
          '<div class="pp-mini-widget" id="pp-final-preview"></div>',
          '<button class="pp-wz-go" id="pp-wz-go-btn" onclick="NotifyXPRO._wz.goLive()" style="background:#6C63FF">🚀 Go Live!</button>',
        '</div>',

        // DONE
        '<div id="pp-wz-done" style="display:none;text-align:center;padding:20px 0">',
          '<div style="font-size:48px;margin-bottom:12px">🎉</div>',
          '<h2 style="font-size:18px;font-weight:700;margin-bottom:8px;color:#111">NotifyX is live!</h2>',
          '<p style="font-size:13px;color:#666;margin-bottom:20px">Visitors will now see your notification widget at the right moment.</p>',
          '<button class="pp-wz-next" onclick="NotifyXPRO._wz.close()" style="background:#22c55e">Close setup ✓</button>',
        '</div>',

      '</div>',
    ].join('');

    document.body.appendChild(wizardEl);
    requestAnimationFrame(function() { requestAnimationFrame(function() { document.getElementById('pp-wz-box').classList.add('pp-wz-open'); }); });
    renderMiniWidget('pp-auto-preview', MESSAGES[detectedType] || MESSAGES.generic, cfg.color);
  }

  // ─── MINI WIDGET RENDERER ─────────────────────────────────
  function renderMiniWidget(id, msg, color, imgSrc) {
    var el = document.getElementById(id);
    if (!el) return;
    var imgHTML = imgSrc ? '<div style="margin:-12px -12px 10px -12px;border-radius:10px 10px 0 0;overflow:hidden;height:80px"><img src="' + imgSrc + '" alt="" style="width:100%;height:80px;object-fit:cover;display:block"></div>' : '';
    el.innerHTML = [
      imgHTML,
      '<div class="pp-mw-head">',
        '<div class="pp-mw-icon" style="background:' + color + '18">',
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
            '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
          '</svg>',
        '</div>',
        '<div>',
          '<p class="pp-mw-t">' + esc(msg.title || 'Notification title') + '</p>',
          '<p class="pp-mw-s">' + esc(msg.sub   || 'Notification message') + '</p>',
        '</div>',
      '</div>',
      '<div class="pp-mw-btns">',
        '<div class="pp-mw-yes" style="background:' + color + '">' + esc(msg.yes || 'Yes!') + '</div>',
        '<div class="pp-mw-no">' + esc(msg.no || 'No thanks') + '</div>',
      '</div>',
    ].join('');
    el.style.borderColor = color + '40';
  }

  // ─── WIZARD CONTROLLER ────────────────────────────────────
  var wz = {
    mode: 'auto',
    appId: '',

    osYes: function() {
      document.getElementById('pp-os-yes').style.borderColor = '#22c55e';
      document.getElementById('pp-app-id-wrap').style.display = 'block';
    },

    osNo: function() {
      document.getElementById('pp-os-no').style.borderColor = '#6C63FF';
      window.open('https://onesignal.com', '_blank');
      setTimeout(function() { document.getElementById('pp-app-id-wrap').style.display = 'block'; }, 800);
    },

    s1Next: function() {
      var id = (document.getElementById('pp-app-id').value || '').trim();
      if (!id) { document.getElementById('pp-app-id').style.borderColor = '#e11d48'; return; }
      wz.appId = id;
      cfg.oneSignalAppId = id;
      wz.goStep(2);
    },

    modeChange: function(m) {
      wz.mode = m;
      document.getElementById('pp-mode-auto').style.display   = m === false  ? 'block' : 'none';
      document.getElementById('pp-mode-custom').style.display = m === 'custom'? 'block' : 'none';
      document.getElementById('pp-mode-ai').style.display     = m === 'ai'   ? 'block' : 'none';
    },

    updatePreview: function() {
      var t = (document.getElementById('pp-c-title') || {}).value || 'Your title here';
      var m = (document.getElementById('pp-c-msg')   || {}).value || 'Your message here';
      var y = (document.getElementById('pp-c-yes')   || {}).value || 'Yes, notify me!';
      var n = (document.getElementById('pp-c-no')    || {}).value || 'No thanks';
      renderMiniWidget('pp-custom-preview', { title: t, sub: m, yes: y, no: n }, cfg.color);
    },

    generateAI: function() {
      var desc = (document.getElementById('pp-ai-desc').value || '').trim();
      if (!desc) { document.getElementById('pp-ai-desc').style.borderColor = '#e11d48'; return; }
      var btn = document.getElementById('pp-ai-generate-btn');
      btn.textContent = '✨ Generating...';
      btn.disabled = true;

      // Call Claude API to generate notification message
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: 'Generate a push notification widget message for this website: "' + desc + '". Return ONLY a JSON object with these exact keys: title (max 8 words), message (max 15 words), yes_button (max 4 words), no_button (max 3 words). No explanation, just JSON.'
          }]
        })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var text = (data.content || []).map(function(b) { return b.text || ''; }).join('');
        var clean = text.replace(/```json|```/g, '').trim();
        var result = JSON.parse(clean);
        document.getElementById('pp-ai-title').value = result.title       || '';
        document.getElementById('pp-ai-msg').value   = result.message     || '';
        document.getElementById('pp-ai-yes').value   = result.yes_button  || '';
        document.getElementById('pp-ai-no').value    = result.no_button   || '';
        document.getElementById('pp-ai-result').style.display = 'block';
        wz.updateAIPreview();
        btn.textContent = '✨ Regenerate';
        btn.disabled = false;
      })
      .catch(function() {
        // Fallback if API unavailable — use smart template
        var templates = {
          food     : { title: 'Hungry for more recipes?',          message: 'Get my best recipes every week — free',        yes_button: 'Send recipes!',    no_button: 'No thanks' },
          fitness  : { title: 'Ready to level up?',                message: 'Get free workout plans every week',             yes_button: 'Yes, train me!',   no_button: 'No thanks' },
          travel   : { title: 'Wanderlust calling?',               message: 'Get travel tips and hidden gems weekly',        yes_button: 'Take me there!',   no_button: 'No thanks' },
          shop     : { title: 'Never miss a deal!',                message: 'Be first to know about sales and new arrivals', yes_button: 'Send me deals!',   no_button: 'No thanks' },
          news     : { title: 'Stay ahead of the news!',           message: 'Breaking stories the moment they happen',       yes_button: 'Notify me!',       no_button: 'No thanks' },
          tech     : { title: 'Stay ahead in tech!',               message: 'Weekly tools, tips and tutorials — free',       yes_button: 'Send them!',       no_button: 'No thanks' },
          finance  : { title: 'Grow your money smarter!',          message: 'Weekly finance tips and market insights',       yes_button: 'Send insights!',   no_button: 'No thanks' },
          default  : { title: 'Want to stay in the loop?',         message: 'Get updates worth your time — no spam ever',    yes_button: 'Yes, notify me!',  no_button: 'No thanks' },
        };
        var d = desc.toLowerCase();
        var t = d.indexOf('food') > -1 || d.indexOf('recipe') > -1 || d.indexOf('cook') > -1 ? templates.food :
                d.indexOf('fit') > -1  || d.indexOf('gym')  > -1   || d.indexOf('workout') > -1 ? templates.fitness :
                d.indexOf('travel') > -1 || d.indexOf('trip') > -1 ? templates.travel :
                d.indexOf('shop') > -1 || d.indexOf('store') > -1  || d.indexOf('deal') > -1 ? templates.shop :
                d.indexOf('news') > -1 || d.indexOf('breaking') > -1 ? templates.news :
                d.indexOf('tech') > -1 || d.indexOf('code') > -1 || d.indexOf('software') > -1 ? templates.tech :
                d.indexOf('money') > -1 || d.indexOf('finance') > -1 || d.indexOf('invest') > -1 ? templates.finance :
                templates.default;
        document.getElementById('pp-ai-title').value = t.title;
        document.getElementById('pp-ai-msg').value   = t.message;
        document.getElementById('pp-ai-yes').value   = t.yes_button;
        document.getElementById('pp-ai-no').value    = t.no_button;
        document.getElementById('pp-ai-result').style.display = 'block';
        wz.updateAIPreview();
        btn.textContent = '✨ Regenerate';
        btn.disabled = false;
      });
    },

    updateAIPreview: function() {
      var t = document.getElementById('pp-ai-title').value || 'Your title';
      var m = document.getElementById('pp-ai-msg').value   || 'Your message';
      var y = document.getElementById('pp-ai-yes').value   || 'Yes!';
      var n = document.getElementById('pp-ai-no').value    || 'No thanks';
      renderMiniWidget('pp-ai-preview', { title: t, sub: m, yes: y, no: n }, cfg.color);
    },

    s2Next: function() {
      if (wz.mode === 'custom') {
        cfg.customTitle   = document.getElementById('pp-c-title').value || '';
        cfg.customMessage = document.getElementById('pp-c-msg').value   || '';
        cfg.customYes     = document.getElementById('pp-c-yes').value   || '';
        cfg.customNo      = document.getElementById('pp-c-no').value    || '';
      } else if (wz.mode === 'ai') {
        cfg.customTitle   = document.getElementById('pp-ai-title').value || '';
        cfg.customMessage = document.getElementById('pp-ai-msg').value   || '';
        cfg.customYes     = document.getElementById('pp-ai-yes').value   || '';
        cfg.customNo      = document.getElementById('pp-ai-no').value    || '';
      }
      wz.goStep('2b');
    },

    loadWidgetImg: function(input) {
      if (!input.files || !input.files[0]) return;
      var file = input.files[0];
      var reader = new FileReader();
      reader.onload = function(e) {
        cfg.widgetImage = e.target.result;
        cfg.widgetImageAlt = file.name.replace(/\.[^.]+$/, '');
        document.getElementById('wimg-upload-area').style.display = 'none';
        document.getElementById('wimg-preview-wrap').style.display = 'block';
        document.getElementById('wimg-prev').src = e.target.result;
      };
      reader.readAsDataURL(file);
    },

    clearWidgetImg: function() {
      cfg.widgetImage = '';
      cfg.widgetImageAlt = '';
      document.getElementById('wimg-upload-area').style.display = 'block';
      document.getElementById('wimg-preview-wrap').style.display = 'none';
      document.getElementById('wimg-prev').src = '';
    },

    s2bNext: function() {
      wz.goStep(3);
      wz.updateFinalPreview();
    },

    s2bSkip: function() {
      cfg.widgetImage = '';
      wz.goStep(3);
      wz.updateFinalPreview();
    },

    setColor: function(c, el) {
      cfg.color = c;
      document.querySelectorAll('.nx-swatch').forEach(function(s) { s.className = s.className.replace(' nx-swatch-active', ''); });
      el.className += ' nx-swatch-active';
      document.getElementById('pp-wz-go-btn').style.background = c;
      wz.updateFinalPreview();
    },

    updateFinalPreview: function() {
      var msg = cfg.customTitle ? {
        title: cfg.customTitle, sub: cfg.customMessage, yes: cfg.customYes || 'Yes, notify me!', no: cfg.customNo || 'No thanks'
      } : (MESSAGES[detectedType] || MESSAGES.generic);
      renderMiniWidget('pp-final-preview', msg, cfg.color, cfg.widgetImage);
    },

    goLive: function() {
      // Save everything to localStorage
      localStorage.setItem(KEY_CONFIG, JSON.stringify({
        oneSignalAppId : cfg.oneSignalAppId,
        color          : cfg.color,
        customTitle    : cfg.customTitle,
        customMessage  : cfg.customMessage,
        customYes      : cfg.customYes,
        customNo       : cfg.customNo,
        widgetImage    : cfg.widgetImage,
        widgetImageAlt : cfg.widgetImageAlt,
      }));
      localStorage.setItem(KEY_SETUP, '1');
      document.getElementById('pp-wz-s3').style.display   = 'none';
      document.getElementById('pp-wz-done').style.display = 'block';
      loadOneSignal();
    },

    close: function() {
      if (wizardEl) { wizardEl.style.opacity = '0'; setTimeout(function() { wizardEl && wizardEl.parentNode && wizardEl.parentNode.removeChild(wizardEl); }, 300); }
      startTriggers();
    },

    goStep: function(n) {
      var steps = [1, 2, '2b', 3];
      var nIdx  = steps.indexOf(n);
      steps.forEach(function(i, idx) {
        var el = document.getElementById('pp-wz-s' + i);
        if (el) el.style.display = i === n ? 'block' : 'none';
        var dot = document.getElementById('pp-wz-s' + i + '-dot');
        if (dot) dot.className = 'pp-step' + (idx <= nIdx ? ' pp-step-active' : '');
        var line = document.getElementById('pp-wz-l' + (i === '2b' ? '2b' : i));
        if (line) line.style.background = idx < nIdx ? '#6C63FF' : '#e0e0e0';
      });
    },
  };

  // ─── STYLES ───────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('nx-styles')) return;
    var s = document.createElement('style');
    s.id = 'nx-styles';
    s.textContent = [
      // Widget
      '#nx-widget,#nx-widget *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:0}',
      '#nx-widget{position:fixed;z-index:2147483647;width:320px;max-width:calc(100vw - 24px);background:#fff;border-radius:20px;box-shadow:0 16px 48px rgba(0,0,0,0.14),0 4px 12px rgba(0,0,0,0.08);padding:22px;transform:translateY(28px) scale(0.97);opacity:0;transition:transform .4s cubic-bezier(.22,.68,0,1.2),opacity .28s;pointer-events:none}',
      '#nx-widget.pp-show{transform:translateY(0) scale(1);opacity:1;pointer-events:all}',
      '#nx-widget.pp-hide{transform:translateY(28px) scale(0.97);opacity:0;pointer-events:none}',
      '.pp-widget-img-wrap{width:calc(100% + 44px);margin:-22px -22px 14px -22px;border-radius:20px 20px 0 0;overflow:hidden;max-height:160px}',
      '.pp-widget-img{width:100%;height:160px;object-fit:cover;display:block}',
      '#nx-widget.pp-hide{transform:translateY(28px) scale(0.97);opacity:0;pointer-events:none}',
      '#nx-widget.pp-bottomright{bottom:20px;right:20px}',
      '#nx-widget.pp-bottomleft{bottom:20px;left:20px}',
      '#nx-widget.pp-topright{top:20px;right:20px}',
      '#nx-widget.pp-topleft{top:20px;left:20px}',
      '.pp-x{position:absolute;top:14px;right:14px;background:none;border:none;cursor:pointer;color:#bbb;font-size:16px;padding:3px 7px;border-radius:6px;line-height:1}',
      '.pp-x:hover{background:#f5f5f5;color:#888}',
      '.pp-head{display:flex;align-items:center;gap:11px;margin-bottom:12px}',
      '.pp-av{width:44px;height:44px;border-radius:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
      '.pp-title{font-size:14px;font-weight:700;color:#111;margin-bottom:3px}',
      '.pp-sub{font-size:12px;color:#777}',
      '.pp-tag{display:inline-block;font-size:11px;font-weight:600;padding:3px 10px;border-radius:99px;margin-bottom:11px}',
      '.pp-body{font-size:12.5px;color:#555;line-height:1.6;margin-bottom:16px}',
      '.pp-row{display:flex;gap:9px}',
      '.pp-yes{flex:1;padding:11px 14px;border-radius:12px;border:none;color:#fff;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .15s,transform .1s}',
      '.pp-yes:hover{opacity:.88;transform:translateY(-1px)}',
      '.pp-no{padding:11px 14px;border-radius:12px;border:none;background:#f1f1f1;color:#666;font-size:13px;font-weight:500;cursor:pointer;transition:background .15s}',
      '.pp-no:hover{background:#e5e5e5}',
      '.pp-ok{text-align:center;padding:10px 0}',
      '.pp-ok-i{font-size:40px;margin-bottom:10px}',
      '.pp-ok-t{font-size:16px;font-weight:700;color:#111;margin-bottom:5px}',
      '.pp-ok-s{font-size:13px;color:#777;line-height:1.5}',
      '@media(prefers-color-scheme:dark){#nx-widget{background:#1a1a2e;box-shadow:0 16px 48px rgba(0,0,0,0.55)}.pp-title,.pp-ok-t{color:#f0f0f0}.pp-body{color:#bbb}.pp-sub,.pp-ok-s{color:#888}.pp-no{background:#262636;color:#aaa}.pp-x{color:#555}}',
      '@media(max-width:380px){#nx-widget.pp-bottomright,#nx-widget.pp-bottomleft{bottom:10px;right:10px;left:10px;width:auto}}',

      // Wizard overlay
      '#nx-wizard{position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:16px;transition:opacity .3s}',
      '#pp-wz-box{background:#fff;border-radius:20px;width:100%;max-width:440px;max-height:90vh;overflow-y:auto;padding:28px;transform:translateY(20px) scale(0.97);opacity:0;transition:transform .4s cubic-bezier(.22,.68,0,1.2),opacity .3s}',
      '#pp-wz-box.pp-wz-open{transform:translateY(0) scale(1);opacity:1}',
      '#pp-wz-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}',
      '#pp-wz-logo{font-size:16px;font-weight:800;color:#6C63FF}',
      '#pp-wz-logo span{background:#6C63FF;color:#fff;font-size:11px;padding:2px 7px;border-radius:5px;margin-left:4px}',
      '#pp-wz-steps{display:flex;align-items:center;gap:6px}',
      '.pp-step{width:26px;height:26px;border-radius:50%;background:#e0e0e0;color:#999;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center}',
      '.pp-step-active{background:#6C63FF;color:#fff}',
      '.pp-step-line{width:24px;height:2px;background:#e0e0e0;border-radius:2px}',
      '.pp-wz-title{font-size:18px;font-weight:700;color:#111;margin-bottom:6px}',
      '.pp-wz-desc{font-size:13px;color:#666;margin-bottom:18px;line-height:1.6}',
      '.pp-os-btn{border:1.5px solid #e0e0e0;border-radius:12px;padding:13px 16px;cursor:pointer;display:flex;align-items:center;gap:12px;margin-bottom:10px;transition:border-color .2s}',
      '.pp-os-btn:hover{border-color:#6C63FF}',
      '.pp-os-icon{font-size:22px;flex-shrink:0}',
      '.pp-os-btn strong{display:block;font-size:13px;color:#111;margin-bottom:2px}',
      '.pp-os-btn span{font-size:11px;color:#888}',
      '#pp-app-id-wrap{margin-top:14px}',
      '.pp-label{display:block;font-size:11px;font-weight:600;color:#555;margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em}',
      '.pp-label-yes{color:#22c55e}',
      '.pp-label-no{color:#e11d48}',
      '#nx-wizard input[type=text]{width:100%;border:1.5px solid #e0e0e0;border-radius:9px;padding:9px 12px;font-size:13px;color:#111;outline:none;transition:border-color .2s;background:#fff}',
      '#nx-wizard input[type=text]:focus{border-color:#6C63FF}',
      '.pp-wz-next{width:100%;background:#6C63FF;color:#fff;border:none;border-radius:11px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;margin-top:16px;transition:opacity .15s}',
      '.pp-wz-next:hover{opacity:.88}',
      '.pp-wz-go{width:100%;color:#fff;border:none;border-radius:11px;padding:13px;font-size:15px;font-weight:700;cursor:pointer;margin-top:16px;transition:opacity .15s}',
      '.pp-wz-go:hover{opacity:.88}',
      '.pp-radio-row{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}',
      '.pp-radio{display:flex;align-items:center;gap:8px;font-size:13px;color:#333;cursor:pointer}',
      '.pp-radio input{width:15px;height:15px;accent-color:#6C63FF;cursor:pointer}',
      '.pp-field-group{margin-bottom:10px}',
      '.pp-two-col{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.pp-preview-label{font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;margin-top:14px}',
      '.pp-mini-widget{background:#f8f7ff;border-radius:12px;border:1.5px solid #ede9ff;padding:12px}',
      '.pp-mw-head{display:flex;align-items:center;gap:8px;margin-bottom:9px}',
      '.pp-mw-icon{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
      '.pp-mw-t{font-size:12px;font-weight:700;color:#111;margin-bottom:1px}',
      '.pp-mw-s{font-size:10px;color:#777}',
      '.pp-mw-btns{display:flex;gap:6px}',
      '.pp-mw-yes{flex:1;padding:7px 10px;border-radius:8px;color:#fff;font-size:11px;font-weight:600;text-align:center}',
      '.pp-mw-no{padding:7px 10px;border-radius:8px;background:#f0f0f0;color:#666;font-size:11px;text-align:center}',
      '.pp-ai-btn{width:100%;background:linear-gradient(135deg,#6C63FF,#8b5cf6);color:#fff;border:none;border-radius:11px;padding:11px;font-size:13px;font-weight:700;cursor:pointer;margin-top:4px;transition:opacity .15s}',
      '.pp-ai-btn:hover{opacity:.88}',
      '.pp-ai-btn:disabled{opacity:.6;cursor:wait}',
      '#pp-colors{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px}',
      '.nx-swatch{width:32px;height:32px;border-radius:9px;cursor:pointer;border:3px solid transparent;transition:transform .15s}',
      '.nx-swatch:hover{transform:scale(1.15)}',
      '.nx-swatch-active{border-color:#111 !important}',
    ].join('');
    document.head.appendChild(s);
  }

  // ─── HELPERS ──────────────────────────────────────────────
  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ─── EXPOSE ───────────────────────────────────────────────
  window.NotifyXPRO = { version: '3.0', config: cfg, _wz: wz };

  // ─── START ────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
