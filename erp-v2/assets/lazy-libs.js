(() => {
  'use strict';

  const pending = new Map();
  function load(globalName, src, label) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    if (pending.has(globalName)) return pending.get(globalName);
    const request = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => window[globalName]
        ? resolve(window[globalName])
        : reject(new Error(`${label}載入失敗`));
      script.onerror = () => reject(new Error(`${label}載入失敗，請確認網路後再試`));
      document.head.appendChild(script);
    }).catch(error => {
      pending.delete(globalName);
      throw error;
    });
    pending.set(globalName, request);
    return request;
  }

  window.ERP_LAZY_LIBS = {
    xlsx: () => load('XLSX', 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', 'Excel 元件'),
    pdf: () => load('PDFLib', 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js', 'PDF 元件'),
  };
})();
