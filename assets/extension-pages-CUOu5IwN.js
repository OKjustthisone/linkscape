function s(n){const t=chrome.runtime.getManifest().options_page??"options.html",e=t.lastIndexOf("/"),o=e>=0?t.slice(0,e+1):"";return chrome.runtime.getURL(`${o}${n}.html`)}export{s as g};
