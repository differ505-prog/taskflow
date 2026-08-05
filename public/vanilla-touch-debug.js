// V14 原生監聽：繞過 React，直接在瀏覽器底層偵測 touch 事件
(function() {
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
