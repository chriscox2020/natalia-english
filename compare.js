// Word-level comparison for Natalia's Car Mode. Works in browser (window.Cmp) and node (module.exports).
(function(root){
const ONES=["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
const TENS=["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
function num2w(n){n=parseInt(n,10);if(isNaN(n))return"";if(n<20)return ONES[n];if(n<100)return TENS[Math.floor(n/10)]+(n%10?" "+ONES[n%10]:"");if(n<1000)return ONES[Math.floor(n/100)]+" hundred"+(n%100?" "+num2w(n%100):"");return String(n);}
const CONTR={"i'm":"i am","it's":"it is","let's":"let us","that's":"that is","what's":"what is","i'll":"i will","you're":"you are","we're":"we are","don't":"do not","doesn't":"does not","can't":"can not","cannot":"can not","i've":"i have","we've":"we have","isn't":"is not","won't":"will not","there's":"there is","he's":"he is","she's":"she is","i'd":"i would","chris's":"chris"};
function norm(s){
  s=(s||"").toLowerCase().replace(/[\[\(][^\]\)]*[\]\)]/g," ").replace(/[’‘`]/g,"'");
  s=s.replace(/d\.c\./g,"dc").replace(/(\d+)%/g,"$1 percent").replace(/\d+/g,m=>" "+num2w(m)+" ");
  s=s.replace(/-/g," ").replace(/[^a-z' ]+/g," ");
  let w=s.split(/\s+/).filter(Boolean).map(x=>x.replace(/^'+|'+$/g,""));
  let out=[];for(const x of w){const c=CONTR[x];if(c)out.push(...c.split(" "));else if(x.endsWith("'s"))out.push(x.slice(0,-2));else if(x)out.push(x);}
  return out;
}
function lev(a,b){const m=a.length,n=b.length;if(!m)return n;if(!n)return m;let p=Array(n+1).fill(0).map((_,i)=>i);for(let i=1;i<=m;i++){let c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c;}return p[n];}
function wordEq(a,b){if(a===b)return true;const L=Math.max(a.length,b.length);if(L<=3)return false;return 1-lev(a,b)/L>=0.75;}
const MINOR=new Set(["a","an","the","is","am","are","to","of","and","in","on","at","for","it","us"]);
function compare(target,heard){
  const T=norm(target),H=norm(heard);const m=T.length,n=H.length;
  const dp=Array(m+1).fill(0).map(()=>Array(n+1).fill(0));
  for(let i=m-1;i>=0;i--)for(let j=n-1;j>=0;j--)dp[i][j]=wordEq(T[i],H[j])?1+dp[i+1][j+1]:Math.max(dp[i+1][j],dp[i][j+1]);
  const matched=Array(m).fill(false);let i=0,j=0;
  while(i<m&&j<n){if(wordEq(T[i],H[j])){matched[i]=true;i++;j++;}else if(dp[i+1][j]>=dp[i][j+1])i++;else j++;}
  const missing=T.filter((_,k)=>!matched[k]);
  const score=m?dp[0][0]/m:0;
  const extra=Math.max(0,n-dp[0][0]);
  const key=missing.find(x=>!MINOR.has(x))||missing[0]||null;
  let verdict;
  if(n===0||score<0.34)verdict="unclear";else if(score>=0.85&&(!key||MINOR.has(key)))verdict="ok";else verdict="word";
  if(score>=0.85&&missing.every(x=>MINOR.has(x)))verdict="ok";
  return {score:Math.round(score*100)/100,missing,key,verdict,target:T,heard:H,extra};
}
function hasWord(word,heard){return norm(heard).some(h=>wordEq(norm(word)[0]||word,h));}
function command(heard){const H=norm(heard);const raw=(heard||"").toLowerCase();
  if(H.length<=3&&H.some(w=>/^(quiet|quite|quieter|tiho|tikho|teeho|teho|tee|keyhole)$/.test(w))||/тихо/.test(raw))return"stop";
  if(H.length<=3&&H.some(w=>/^(back|nazad|nazar|nasad|azad)$/.test(w))||/назад/.test(raw))return"back";
  return null;}
const api={norm,compare,hasWord,command,wordEq};
if(typeof module!=="undefined")module.exports=api;else root.Cmp=api;
})(this);
