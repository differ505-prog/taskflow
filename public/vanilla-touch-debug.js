// V15 全域錯誤捕捉 + 原生監聽
// (1) 繞過 React 直接偵測瀏覽器底層 touch 事件
// (2) 攔截任何致命錯誤，強制顯示紅色死亡畫面（iOS Safari 上 React 死鎖時的救星）

(function() {
  // ============ 死亡畫面錯誤捕捉器 ============
  function showDeathScreen(title, detail) {
    try {
      var existing = document.getElementById('debug-death-screen');
      if (existing) existing.parentNode.removeChild(existing);
      var errDiv = document.createElement('div');
      errDiv.id = 'debug-death-screen';
      errDiv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(255,0,0,0.95);color:white;z-index:99999999;padding:20px;overflow:auto;word-wrap:break-word;font-size:14px;font-family:monospace;pointer-events:auto;';
      errDiv.innerHTML = '<h3 style="font-size:18px;margin:0 0 12px 0;">' + title + '</h3><pre style="white-space:pre-wrap;word-wrap:break-word;margin:0;">' + detail + '</pre>';
      if (document.body) {
        document.body.appendChild(errDiv);
      } else {
        document.addEventListener('DOMContentLoaded', function() {
          document.body.appendChild(errDiv);
        });
      }
    } catch (e) {
      // 連錯誤捕捉都失敗了，至少寫到 title
      document.title = '[FATAL] ' + title + ' | ' + detail.substring(0, 100);
    }
  }

  // 同步錯誤
  window.addEventListener('error', function(event) {
    var detail = '訊息: ' + (event.message || '未知') + '\n' +
                 '檔案: ' + (event.filename || '?') + ':' + (event.lineno || '?') + ':' + (event.colno || '?') + '\n' +
                 '堆疊: ' + (event.error && event.error.stack ? event.error.stack.substring(0, 500) : '無 stack') + '\n' +
                 '時間: ' + new Date().toISOString();
    showDeathScreen('💥 致命錯誤', detail);
  });

  // Promise 拒絕
  window.addEventListener('unhandledrejection', function(event) {
    var reason = event.reason;
    var msg = '未知';
    var stack = '無堆疊';
    if (reason) {
      if (typeof reason === 'string') {
        msg = reason;
      } else if (reason.message) {
        msg = reason.message;
      }
      if (reason.stack) {
        stack = String(reason.stack).substring(0, 500);
      }
    }
    var detail = '原因: ' + msg + '\n' +
                 '堆疊: ' + stack + '\n' +
                 '時間: ' + new Date().toISOString();
    showDeathScreen('💥 Promise 拒絕', detail);
  });

  // console.error 也攔截（React/Next.js 經常用 console.error 報錯）
  var origConsoleError = console.error;
  console.error = function() {
    var args = Array.prototype.slice.call(arguments);
    var detail = args.map(function(a) {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a, null, 2); } catch(e) { return String(a); }
    }).join('\n').substring(0, 1000);
    showDeathScreen('⚠️ console.error', detail);
    origConsoleError.apply(console, args);
  };

  // ============ V14 原生 touch 監聽 ============
  window.addEventListener('touchstart', function(e) {
    var el = document.getElementById('debug-vanilla');
    if (!el) {
      el = document.createElement('div');
      el.id = 'debug-vanilla';
      el.style.cssText = 'position:fixed;top:0;right:0;background:red;color:white;z-index:9999999;padding:10px;font-size:14px;pointer-events:none;font-weight:bold;';
      document.body.appendChild(el);
    }
    var touch = e.touches[0];
    el.innerText = '原生觸控: ' + (touch ? touch.clientX + ',' + touch.clientY : 'null') + ' | ' + Date.now();
  }, { capture: true, passive: true });

  window.addEventListener('click', function(e) {
    var el = document.getElementById('debug-vanilla');
    if (el) {
      el.innerText = '原生Click: ' + e.clientX + ',' + e.clientY + ' | ' + Date.now();
    }
  }, { capture: true, passive: true });

  window.addEventListener('touchend', function(e) {
    var el = document.getElementById('debug-vanilla');
    if (el) {
      var touch = e.changedTouches[0];
      el.innerText = '原生TouchEnd: ' + (touch ? touch.clientX + ',' + touch.clientY : 'null') + ' | ' + Date.now();
    }
  }, { capture: true, passive: true });
})();
