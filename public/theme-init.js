// Applies the Auto / Light / Dark choice before the page paints (no flash of the wrong theme).
// "Auto" follows the device and keeps following it while the page is open.
;(function () {
  var KEY = 'smashlab.theme'
  var root = document.documentElement
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
  function pref() {
    try {
      var v = localStorage.getItem(KEY)
      return v === 'light' || v === 'dark' ? v : 'auto'
    } catch (e) {
      return 'auto'
    }
  }
  function apply() {
    var p = pref()
    var dark = p === 'dark' || (p === 'auto' && !!mq && mq.matches)
    root.setAttribute('data-theme', dark ? 'dark' : 'light')
    root.style.colorScheme = dark ? 'dark' : 'light'
  }
  apply()
  if (mq && mq.addEventListener) mq.addEventListener('change', apply)
  window.__smashlabApplyTheme = apply
})()
