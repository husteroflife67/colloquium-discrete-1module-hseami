/** Decorative vector artwork; it never presents invented learning statistics. */
export function LearningArt({ variant = "hero" }: { variant?: "hero" | "discrete" | "calculus" }) {
  if (variant === "discrete") return <svg className="learning-art" viewBox="0 0 480 180" fill="none" aria-hidden="true">
    <path d="M0 140H480M30 0V180M100 0V180M170 0V180M240 0V180M310 0V180M380 0V180M450 0V180" stroke="#1e6050" opacity=".12" />
    <g className="art-orbit" stroke="#203b35" strokeWidth="2"><path d="m290 47 85-18 50 90-101 30-34-102 135 72M290 47l135 72M375 29l-51 120" /><circle cx="290" cy="47" r="14" fill="#fff8de" /><circle cx="375" cy="29" r="14" fill="#ad95ed" /><circle cx="425" cy="119" r="14" fill="#ff916b" /><circle cx="324" cy="149" r="14" fill="#fff8de" /></g>
    <g transform="rotate(-8 150 91)"><rect x="77" y="29" width="142" height="119" rx="17" fill="#fffef6" stroke="#203b35" strokeWidth="2" /><circle cx="132" cy="87" r="34" fill="#b7a1f0" fillOpacity=".7" stroke="#203b35" strokeWidth="2" /><circle cx="167" cy="87" r="34" fill="#ffa17e" fillOpacity=".7" stroke="#203b35" strokeWidth="2" /></g>
    <path d="m31 44 4-11 4 11 11 4-11 4-4 11-4-11-11-4 11-4Z" fill="#203b35" /><path d="m244 135 4-11 4 11 11 4-11 4-4 11-4-11-11-4 11-4Z" fill="#203b35" />
  </svg>;
  if (variant === "calculus") return <svg className="learning-art" viewBox="0 0 480 180" fill="none" aria-hidden="true">
    <path d="M0 35H480M0 75H480M0 115H480M0 155H480M40 0V180M100 0V180M160 0V180M220 0V180M280 0V180M340 0V180M400 0V180M460 0V180" stroke="#6b3d30" opacity=".12" />
    <g transform="rotate(7 326 88)"><rect x="231" y="21" width="190" height="135" rx="17" fill="#fffef6" stroke="#402e31" strokeWidth="2" /><path d="M254 130h144M269 140V40" stroke="#402e31" strokeWidth="1.5" /><path className="art-curve" d="M270 123c40 0 30-61 70-69 21-5 40-5 55-5" stroke="#7554bd" strokeWidth="4" strokeLinecap="round" /><path d="M270 49h125" stroke="#9e8db4" strokeDasharray="4 5" /><circle cx="341" cy="54" r="6" fill="#f58663" stroke="#402e31" strokeWidth="2" /></g>
    <g className="art-orbit" transform="rotate(-9 128 88)"><rect x="75" y="36" width="102" height="105" rx="18" fill="#b9aadf" stroke="#402e31" strokeWidth="2" /><path d="M145 58H107l20 29-20 29h38" stroke="#402e31" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></g>
    <path d="m33 125 4-11 4 11 11 4-11 4-4 11-4-11-11-4 11-4ZM192 32l4-11 4 11 11 4-11 4-4 11-4-11-11-4 11-4Z" fill="#402e31" />
  </svg>;
  return <svg className="learning-art learning-art-hero" viewBox="0 0 480 360" fill="none" aria-hidden="true">
    <circle cx="247" cy="179" r="145" stroke="#dcd5e7" strokeDasharray="4 8" />
    <path d="M44 196h402M247 26v308" stroke="#e4dfeb" />
    <path d="m82 119 42-62h195l78 194-166 50L82 119Z" fill="#ede7f6" />
    <g transform="rotate(-12 160 124)"><rect x="55" y="42" width="176" height="155" rx="21" fill="#f9aa87" stroke="#302743" strokeWidth="2" /><path d="M66 153 218 70M66 173 220 90M71 189 221 109" stroke="#302743" strokeOpacity=".15" strokeWidth="1.5" /><rect x="86" y="66" width="114" height="108" rx="10" fill="#fffdf5" stroke="#302743" strokeWidth="2" /><path d="M109 90h62M109 104h42M109 146h62" stroke="#302743" strokeWidth="3" strokeLinecap="round" /><rect x="110" y="117" width="13" height="13" rx="3" fill="#b7a1e4" /><path d="m113 122 3 3 6-7" stroke="#302743" strokeWidth="1.5" /></g>
    <g className="art-float"><g transform="rotate(8 316 222)"><rect x="209" y="118" width="204" height="186" rx="23" fill="#ac98dc" stroke="#302743" strokeWidth="2" /><rect x="235" y="144" width="152" height="134" rx="13" fill="#fffdf5" stroke="#302743" strokeWidth="2" /><path d="M253 256h113M266 260v-95" stroke="#302743" strokeWidth="1.5" /><path className="art-curve" d="M267 246c30-1 22-53 52-59 16-4 29-5 45-5" stroke="#7c5bbb" strokeWidth="4" strokeLinecap="round" /><path d="M267 181h97" stroke="#b3a3c9" strokeDasharray="3 5" /><circle cx="319" cy="187" r="5" fill="#f2a17d" stroke="#302743" strokeWidth="1.5" /></g></g>
    <g className="art-float art-float-delayed"><rect x="287" y="34" width="94" height="74" rx="18" fill="#b9dfc9" stroke="#302743" strokeWidth="2" /><path d="m307 71 20-19 32 20-22 19-30-20ZM327 52l10 39M307 71l52 1" stroke="#302743" strokeWidth="1.5" /><circle cx="307" cy="71" r="4" fill="#fffdf5" stroke="#302743" /><circle cx="327" cy="52" r="4" fill="#fffdf5" stroke="#302743" /><circle cx="359" cy="72" r="4" fill="#fffdf5" stroke="#302743" /><circle cx="337" cy="91" r="4" fill="#fffdf5" stroke="#302743" /></g>
    <path className="art-sparkle" d="m420 71 7-19 7 19 19 7-19 7-7 19-7-19-19-7 19-7Z" fill="#eb865f" /><path d="m97 280 7-19 7 19 19 7-19 7-7 19-7-19-19-7 19-7Z" fill="#8062b2" />
    <circle cx="441" cy="238" r="6" fill="#a4cbb4" /><circle cx="54" cy="226" r="5" fill="#f6af87" />
    <path d="M156 317c11 13 35 13 51 1m-8-5 8 5-4 9" stroke="#302743" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
