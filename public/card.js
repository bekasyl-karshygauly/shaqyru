const PR=[0,2490,3990,5990,8990],TN=["","Базовый","Стандарт","Премиум","Люкс"];
const EV=[["Үйлену той","Свадьба","💍","Қадірлі қонақтар! Өміріміздегі ең қуанышты күнде сіздерді қасымызда көргіміз келеді. Той дастарханына қонақ болыңыздар!","Дорогие гости! В самый счастливый день нашей жизни мы хотим видеть вас рядом. Будем рады разделить с вами радость праздника!"],
["Қыз ұзату","Қыз ұзату","🌸","Сүйікті қызымыздың ақ жолына бата беріп, ұзату тойына қонақ болуға шақырамыз.","Приглашаем вас проводить нашу любимую дочь в новую жизнь и разделить с нами эту трогательную минуту."],
["Бесік той","Бесік той","👶","Шаңырағымызға нәресте келіп, шаттық сыйлады. Бесік тойына арнайы шақырамыз!","В нашем доме появилось маленькое чудо. Приглашаем на бесік той!"],
["Сүндет той","Сүндет той","🎉","Ұлымыздың сүндет тойына келіп, бата-тілектеріңізді білдіруге шақырамыз.","Приглашаем на сүндет той нашего сына, чтобы разделить радость и благословить его."],
["Сырға салу","Сырға салу","✨","Қызымыздың сырға салу тойына шақырамыз. Қуанышымызға ортақ болыңыздар!","Приглашаем на сырға салу, праздник нашей маленькой принцессы. Разделите с нами радость!"],
["Мерей той","Юбилей","🏆","Өмір жолындағы айтулы белесті бірге атап өтейік! Мерейтойға шақырамыз.","Давайте вместе отметим важную веху жизни! Приглашаем на юбилей."],
["Құдалық","Құдалық","🤝","Екі әулеттің жақындығына арналған құдалық дастарханына шақырамыз.","Приглашаем на құдалық: встречу двух семей, начало большого родства."],
["Қоныс той","Новоселье","🏠","Жаңа шаңырағымыздың шарапатын бөлісіп, қоныс тойына келуіңізді сұраймыз.","Приглашаем разделить радость нового дома на қоныс той."],
["Тұсаукесер","Тұсаукесер","👣","Балапанымыздың алғашқы қадамына арналған тұсаукесер тойына шақырамыз!","Приглашаем на тұсаукесер: первый шаг нашего малыша!"],
["Тілашар","Тілашар","💬","Балапанымыздың тілі шығуына арналған тілашар тойына шақырамыз.","Приглашаем на тілашар: праздник в честь первых слов нашего малыша."],
["Туған күн","День рождения","🎂","Туған күнді бірге атап өтейік! Көңілді кешке шақырамыз.","Отметим день рождения вместе! Приглашаем на весёлый праздник."]];
const EV_ICONS=[
{bg:"linear-gradient(135deg,rgba(253,230,138,.4),rgba(244,63,94,.22))",glow:"rgba(244,63,94,.35)",svg:`<svg viewBox="0 0 24 24" class="ev-svg ev-rings" fill="none"><defs><linearGradient id="evg0-r1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FDE047"/><stop offset="100%" stop-color="#D97706"/></linearGradient><linearGradient id="evg0-r2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FDA4AF"/><stop offset="100%" stop-color="#E11D48"/></linearGradient><linearGradient id="evg0-gem" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#38BDF8"/></linearGradient></defs><circle class="ring-a" cx="9" cy="14" r="5.6" stroke="url(#evg0-r1)" stroke-width="2.3" stroke-linecap="round"/><circle class="ring-b" cx="15" cy="14" r="5.6" stroke="url(#evg0-r2)" stroke-width="2.3" stroke-linecap="round"/><path class="gem" d="M9 4L11.5 7.2L9 9.2L6.5 7.2Z" fill="url(#evg0-gem)" stroke="#0284C7" stroke-width="0.7"/><path class="glint" d="M9 2V3.5M4.5 4.5L5.5 5.5M13.5 4.5L12.5 5.5" stroke="#FDE047" stroke-width="1.3" stroke-linecap="round"/></svg>`},
{bg:"linear-gradient(135deg,rgba(253,164,175,.4),rgba(225,29,72,.22))",glow:"rgba(225,29,72,.35)",svg:`<svg viewBox="0 0 24 24" class="ev-svg ev-blossom" fill="none"><defs><linearGradient id="evg1-p1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F472B6"/><stop offset="100%" stop-color="#BE185D"/></linearGradient><linearGradient id="evg1-p2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FBCFE8"/><stop offset="100%" stop-color="#FB7185"/></linearGradient><linearGradient id="evg1-c" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FEF08A"/><stop offset="100%" stop-color="#F59E0B"/></linearGradient></defs><path class="petal" d="M12 3C9.8 7 9.8 9.2 12 11.2C14.2 9.2 14.2 7 12 3Z" fill="url(#evg1-p1)"/><path class="petal" d="M21 12C17 9.8 14.8 9.8 12.8 12C14.8 14.2 17 14.2 21 12Z" fill="url(#evg1-p1)"/><path class="petal" d="M12 21C14.2 17 14.2 14.8 12 12.8C9.8 14.8 9.8 17 12 21Z" fill="url(#evg1-p1)"/><path class="petal" d="M3 12C7 14.2 9.2 14.2 11.2 12C9.2 9.8 7 9.8 3 12Z" fill="url(#evg1-p1)"/><path class="petal" d="M18.4 5.6C15 7.8 13.6 9.4 12.6 11.4C14.6 10.4 16.2 9 18.4 5.6Z" fill="url(#evg1-p2)"/><path class="petal" d="M5.6 18.4C9 16.2 10.4 14.6 11.4 12.6C9.4 13.6 7.8 15 5.6 18.4Z" fill="url(#evg1-p2)"/><path class="petal" d="M18.4 18.4C16.2 15 14.6 13.6 12.6 12.6C13.6 14.6 15 16.2 18.4 18.4Z" fill="url(#evg1-p2)"/><path class="petal" d="M5.6 5.6C7.8 9 9.4 10.4 11.4 11.4C10.4 9.4 9 7.8 5.6 5.6Z" fill="url(#evg1-p2)"/><circle cx="12" cy="12" r="3.2" fill="url(#evg1-c)" stroke="#FFF" stroke-width="0.8"/><circle cx="12" cy="12" r="1.3" fill="#D97706"/></svg>`},
{bg:"linear-gradient(135deg,rgba(56,189,248,.35),rgba(253,224,71,.25))",glow:"rgba(56,189,248,.35)",svg:`<svg viewBox="0 0 24 24" class="ev-svg ev-cradle" fill="none"><defs><linearGradient id="evg2-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#38BDF8"/><stop offset="100%" stop-color="#0284C7"/></linearGradient><linearGradient id="evg2-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FDE047"/><stop offset="100%" stop-color="#D97706"/></linearGradient></defs><g class="cradle-rock"><path d="M4 10C4 5.8 7.6 3.8 12 3.8C16.4 3.8 20 5.8 20 10" stroke="url(#evg2-gold)" stroke-width="2.2" stroke-linecap="round"/><path d="M5 10H19L17.5 16H6.5L5 10Z" fill="url(#evg2-body)" stroke="#0369A1" stroke-width="1.2"/><path d="M8 12.5L12 10.5L16 12.5L12 14.5Z" fill="url(#evg2-gold)"/><path d="M3 19C7 21.2 17 21.2 21 19" stroke="url(#evg2-gold)" stroke-width="2.4" stroke-linecap="round"/><path d="M7 16V19.5M17 16V19.5" stroke="url(#evg2-gold)" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="6.8" r="1.5" fill="#F43F5E"/></g></svg>`},
{bg:"linear-gradient(135deg,rgba(16,185,129,.35),rgba(245,158,11,.25))",glow:"rgba(16,185,129,.35)",svg:`<svg viewBox="0 0 24 24" class="ev-svg ev-sundet" fill="none"><defs><linearGradient id="evg3-hat" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#10B981"/><stop offset="100%" stop-color="#047857"/></linearGradient><linearGradient id="evg3-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FDE047"/><stop offset="100%" stop-color="#F59E0B"/></linearGradient></defs><g class="hat-bounce"><path d="M4 16.5C4 10.5 7 6.8 12 6.8C17 6.8 20 10.5 20 16.5H4Z" fill="url(#evg3-hat)" stroke="#065F46" stroke-width="1.2"/><rect x="3" y="16" width="18" height="3.8" rx="1.5" fill="url(#evg3-gold)"/><circle cx="12" cy="11.8" r="2.2" fill="url(#evg3-gold)"/><path class="feather" d="M12 6.8C11 4.2 11.8 2.2 13.5 1.8C13.5 3.8 14.5 4.8 12 6.8Z" fill="#FEF08A" stroke="#F59E0B" stroke-width="0.8"/><path class="feather-2" d="M12 6.8C12.8 4.5 13.6 3.2 15 3C14.5 4.5 14 5.5 12 6.8Z" fill="#FDE047"/></g><path class="spark" d="M19 6L19.7 7.5L21.2 7.8L20 8.8L20.4 10.5L19 9.6L17.6 10.5L18 8.8L16.8 7.8L18.3 7.5L19 6Z" fill="#FBBF24"/></svg>`},
{bg:"linear-gradient(135deg,rgba(192,132,252,.4),rgba(244,63,94,.22))",glow:"rgba(192,132,252,.35)",svg:`<svg viewBox="0 0 24 24" class="ev-svg ev-syrga" fill="none"><defs><linearGradient id="evg4-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FDE047"/><stop offset="100%" stop-color="#D97706"/></linearGradient><linearGradient id="evg4-gem" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2DD4BF"/><stop offset="100%" stop-color="#0F766E"/></linearGradient></defs><g class="syrga-sway"><path d="M9 4.2C9 2.5 11 2 12 2C13 2 14.5 2.8 14.5 4.5V6.8" stroke="url(#evg4-gold)" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="8.5" r="2.4" fill="url(#evg4-gold)" stroke="#B45309" stroke-width="0.8"/><line x1="12" y1="11" x2="12" y2="13" stroke="url(#evg4-gold)" stroke-width="1.8"/><path d="M12 13C8.5 16 8 19 12 21.5C16 19 15.5 16 12 13Z" fill="url(#evg4-gold)" stroke="#B45309" stroke-width="1"/><circle cx="12" cy="18" r="1.8" fill="url(#evg4-gem)"/></g><path class="s-glint" d="M4 6L4.8 7.8L6.5 8.5L4.8 9.2L4 11L3.2 9.2L1.5 8.5L3.2 7.8L4 6Z" fill="#FDE047"/><path class="s-glint2" d="M20 12L20.8 13.5L22.5 14L20.8 14.5L20 16L19.2 14.5L17.5 14L19.2 13.5L20 12Z" fill="#F472B6"/></svg>`},
{bg:"linear-gradient(135deg,rgba(253,224,71,.45),rgba(217,119,6,.28))",glow:"rgba(245,158,11,.35)",svg:`<svg viewBox="0 0 24 24" class="ev-svg ev-trophy" fill="none"><defs><linearGradient id="evg5-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FDE047"/><stop offset="100%" stop-color="#D97706"/></linearGradient></defs><g class="trophy-shine"><path d="M6 4H18V10C18 13.3 15.3 16 12 16C8.7 16 6 13.3 6 10V4Z" fill="url(#evg5-gold)" stroke="#B45309" stroke-width="1.2"/><path d="M6 6H3.5C2.7 6 2 6.7 2 7.5C2 9.5 3.5 11 5.5 11H6" stroke="url(#evg5-gold)" stroke-width="1.8" stroke-linecap="round"/><path d="M18 6H20.5C21.3 6 22 6.7 22 7.5C22 9.5 20.5 11 18.5 11H18" stroke="url(#evg5-gold)" stroke-width="1.8" stroke-linecap="round"/><path d="M12 16V19" stroke="url(#evg5-gold)" stroke-width="2.6" stroke-linecap="round"/><path d="M7 19.5H17L18 22H6L7 19.5Z" fill="url(#evg5-gold)" stroke="#B45309" stroke-width="1"/><path class="star-center" d="M12 6.5L13 9L15.5 9.2L13.5 10.8L14.2 13.2L12 11.8L9.8 13.2L10.5 10.8L8.5 9.2L11 9L12 6.5Z" fill="#FFF"/></g></svg>`},
{bg:"linear-gradient(135deg,rgba(251,146,60,.4),rgba(244,63,94,.25))",glow:"rgba(249,115,22,.35)",svg:`<svg viewBox="0 0 24 24" class="ev-svg ev-qudalyq" fill="none"><defs><linearGradient id="evg6-h1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FB923C"/><stop offset="100%" stop-color="#EA580C"/></linearGradient><linearGradient id="evg6-h2" x1="1" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FDE047"/><stop offset="100%" stop-color="#F59E0B"/></linearGradient></defs><path class="heart-pulse" d="M12 3.5C10.5 1.5 7.5 1.8 6.5 4C5.2 6.8 9.5 10 12 11.5C14.5 10 18.8 6.8 17.5 4C16.5 1.8 13.5 1.5 12 3.5Z" fill="#F43F5E"/><g class="hands"><path d="M2 17L6.5 13.5C7.5 12.8 8.8 13 9.6 13.8L12 16.2L10.2 18L7.5 16.5L4 19.5L2 17Z" fill="url(#evg6-h1)"/><path d="M22 17L17.5 13.5C16.5 12.8 15.2 13 14.4 13.8L12 16.2L13.8 18L16.5 16.5L20 19.5L22 17Z" fill="url(#evg6-h2)"/><path d="M9.5 13.8L12 16.2L14.5 13.8" stroke="#FFF" stroke-width="1.3" stroke-linecap="round"/></g></svg>`},
{bg:"linear-gradient(135deg,rgba(52,211,153,.4),rgba(6,182,212,.22))",glow:"rgba(16,185,129,.35)",svg:`<svg viewBox="0 0 24 24" class="ev-svg ev-home" fill="none"><defs><linearGradient id="evg7-roof" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#34D399"/><stop offset="100%" stop-color="#059669"/></linearGradient><linearGradient id="evg7-wall" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#A7F3D0"/><stop offset="100%" stop-color="#6EE7B7"/></linearGradient></defs><g class="home-pop"><rect x="15" y="4.5" width="2.5" height="5" fill="#047857"/><path class="smoke" d="M16.5 2C16 1.2 17 0.8 17.5 1.2C18 0.8 19 1.2 18.5 2C18 2.8 17.5 3.2 17.5 3.2C17.5 3.2 17 2.8 16.5 2Z" fill="#F43F5E"/><path d="M2 11L12 3L22 11H2Z" fill="url(#evg7-roof)"/><rect x="4.5" y="11" width="15" height="10" rx="1.5" fill="url(#evg7-wall)" stroke="#047857" stroke-width="1"/><path d="M10 21V15C10 13.9 10.9 13 12 13C13.1 13 14 13.9 14 15V21H10Z" fill="#FEF3C7"/><circle cx="12" cy="16.5" r="1.5" fill="#F59E0B"/><circle cx="17.5" cy="16.5" r="1.5" stroke="#F59E0B" stroke-width="1.2"/><line x1="17.5" y1="18" x2="17.5" y2="21" stroke="#F59E0B" stroke-width="1.2"/><line x1="17.5" y1="20" x2="19" y2="20" stroke="#F59E0B" stroke-width="1.2"/></g></svg>`},
{bg:"linear-gradient(135deg,rgba(251,146,60,.4),rgba(253,224,71,.3))",glow:"rgba(251,146,60,.35)",svg:`<svg viewBox="0 0 24 24" class="ev-svg ev-steps" fill="none"><defs><linearGradient id="evg8-feet" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FB923C"/><stop offset="100%" stop-color="#F43F5E"/></linearGradient></defs><g class="step-l"><ellipse cx="7.5" cy="14" rx="2.5" ry="3.5" transform="rotate(-15 7.5 14)" fill="url(#evg8-feet)"/><circle cx="5" cy="9" r="1" fill="url(#evg8-feet)"/><circle cx="6.8" cy="8.2" r="1.1" fill="url(#evg8-feet)"/><circle cx="8.8" cy="8.5" r="1.1" fill="url(#evg8-feet)"/><circle cx="10.5" cy="9.5" r="0.9" fill="url(#evg8-feet)"/><circle cx="11.8" cy="11" r="0.8" fill="url(#evg8-feet)"/></g><g class="step-r"><ellipse cx="15.5" cy="9" rx="2.5" ry="3.5" transform="rotate(15 15.5 9)" fill="url(#evg8-feet)"/><circle cx="19" cy="4" r="1" fill="url(#evg8-feet)"/><circle cx="17.2" cy="3.2" r="1.1" fill="url(#evg8-feet)"/><circle cx="15.2" cy="3.5" r="1.1" fill="url(#evg8-feet)"/><circle cx="13.5" cy="4.5" r="0.9" fill="url(#evg8-feet)"/><circle cx="12.2" cy="6" r="0.8" fill="url(#evg8-feet)"/></g><path class="cord" d="M2 20.5C6 18.5 10 22.5 14 20.5C18 18.5 21 21.5 23 20.5" stroke="#F59E0B" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="2.5 2"/></svg>`},
{bg:"linear-gradient(135deg,rgba(129,140,248,.4),rgba(168,85,247,.25))",glow:"rgba(129,140,248,.35)",svg:`<svg viewBox="0 0 24 24" class="ev-svg ev-tilashar" fill="none"><defs><linearGradient id="evg9-cv" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#818CF8"/><stop offset="100%" stop-color="#4F46E5"/></linearGradient><linearGradient id="evg9-pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#EEF2FF"/></linearGradient></defs><path d="M12 18.5C9 17 4 17 2 18V6C4 5 9 5 12 6.5C15 5 20 5 22 6V18C20 17 15 17 12 18.5Z" fill="url(#evg9-cv)"/><path d="M12 17.5C9.5 16 5 16 3 17V7C5 6 9.5 6 12 7.5C14.5 6 19 6 21 7V17C19 16 14.5 16 12 17.5Z" fill="url(#evg9-pg)"/><line x1="12" y1="7.5" x2="12" y2="17.5" stroke="#818CF8" stroke-width="1.2"/><text x="4.8" y="14" font-size="6.5" font-family="Montserrat,sans-serif" font-weight="800" fill="#4F46E5">А</text><text x="13.8" y="14" font-size="6.5" font-family="Montserrat,sans-serif" font-weight="800" fill="#E11D48">Ә</text><path class="star-float" d="M12 1.5L12.7 3.3L14.5 4L12.7 4.7L12 6.5L11.3 4.7L9.5 4L11.3 3.3L12 1.5Z" fill="#FBBF24"/></svg>`},
{bg:"linear-gradient(135deg,rgba(244,114,182,.4),rgba(249,115,22,.25))",glow:"rgba(244,114,182,.35)",svg:`<svg viewBox="0 0 24 24" class="ev-svg ev-cake" fill="none"><defs><linearGradient id="evg10-base" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#F472B6"/><stop offset="100%" stop-color="#DB2777"/></linearGradient><linearGradient id="evg10-fr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFF"/><stop offset="100%" stop-color="#FCE7F3"/></linearGradient></defs><g class="cake-bounce"><rect x="3" y="15" width="18" height="6" rx="2" fill="url(#evg10-base)"/><rect x="5.5" y="10" width="13" height="5" rx="1.5" fill="#EC4899"/><path d="M3 15C5 17 6.5 15 8.5 17C10.5 15 12.5 17 14.5 15C16.5 17 18.5 15 21 15V13.5H3V15Z" fill="url(#evg10-fr)"/><path d="M5.5 10C7 11.5 8 10 9.5 11.5C11 10 12.5 11.5 14 10C15.5 11.5 17 10 18.5 10V8.5H5.5V10Z" fill="url(#evg10-fr)"/><rect x="11.2" y="5" width="1.6" height="4" rx="0.5" fill="#FDE047"/><path class="flame" d="M12 1.5C11 3 10.5 4 12 5C13.5 4 13 3 12 1.5Z" fill="#F97316"/><circle class="flame-core" cx="12" cy="3.5" r="0.8" fill="#FEF08A"/></g><circle cx="2" cy="8" r="1" fill="#38BDF8"/><circle cx="21" cy="6" r="1" fill="#A855F7"/></svg>`}
];
const LB={kz:{inv:"ШАҚЫРУ",h:"Той иелері"},ru:{inv:"ПРИГЛАШЕНИЕ",h:"Организаторы"}};
const FN=["Lora","Montserrat","Pacifico","Lobster","Oswald","Comfortaa","Caveat"];
const EV_COVERS=[
{ev:0,id:"wedding",name:"Үйлену той",nameRu:"Свадьба",url:"/covers/wedding.jpg"},
{ev:1,id:"kyz_uzatu",name:"Қыз ұзату",nameRu:"Қыз ұзату",url:"/covers/kyz_uzatu.jpg"},
{ev:2,id:"besik",name:"Бесік той",nameRu:"Бесік той (бесік пен нәресте)",url:"/covers/besik.jpg"},
{ev:3,id:"sundet",name:"Сүндет той",nameRu:"Сүндет той",url:"/covers/sundet.jpg"},
{ev:4,id:"syrga",name:"Сырға салу",nameRu:"Сырға салу (алтын сырға)",url:"/covers/syrga.jpg"},
{ev:5,id:"merey",name:"Мерей той",nameRu:"Мерей той / Юбилей",url:"/covers/merey.jpg"},
{ev:6,id:"qudalyq",name:"Құдалық",nameRu:"Құдалық (дастарқан)",url:"/covers/qudalyq.jpg"},
{ev:7,id:"qonys",name:"Қоныс той",nameRu:"Қоныс той / Новоселье",url:"/covers/qonys.jpg"},
{ev:8,id:"tusaukeser",name:"Тұсаукесер",nameRu:"Тұсаукесер (қадам)",url:"/covers/tusaukeser.jpg"},
{ev:9,id:"tilashar",name:"Тілашар",nameRu:"Тілашар (әліппе)",url:"/covers/tilashar.jpg"},
{ev:10,id:"tugan_kun",name:"Туған күн",nameRu:"Туған күн (торт)",url:"/covers/tugan_kun.jpg"}
];
function getDefCover(ev,dsg=0){
if(globalThis.ShaqyruMedia)return globalThis.ShaqyruMedia.defaultCover(ev,dsg);
if(ev===2&&dsg%3===1)return"/covers/besik_cradle.jpg";
if(ev===0&&dsg%4===1)return"/covers/palace.jpg";
if(ev===0&&dsg%4===2)return"/covers/sunset.jpg";
return EV_COVERS[ev]?.url||"/covers/wedding.jpg";
}
const COVERS=[
{id:"wedding",name:"Үйлену той",ev:0,url:"/covers/wedding.jpg"},
{id:"kyz_uzatu",name:"Қыз ұзату",ev:1,url:"/covers/kyz_uzatu.jpg"},
{id:"besik",name:"Бесік той (нәресте)",ev:2,url:"/covers/besik.jpg"},
{id:"besik_cradle",name:"Бесік",ev:2,url:"/covers/besik_cradle.jpg"},
{id:"sundet",name:"Сүндет той",ev:3,url:"/covers/sundet.jpg"},
{id:"syrga",name:"Сырға салу",ev:4,url:"/covers/syrga.jpg"},
{id:"merey",name:"Мерей той",ev:5,url:"/covers/merey.jpg"},
{id:"qudalyq",name:"Құдалық",ev:6,url:"/covers/qudalyq.jpg"},
{id:"qonys",name:"Қоныс той",ev:7,url:"/covers/qonys.jpg"},
{id:"tusaukeser",name:"Тұсаукесер",ev:8,url:"/covers/tusaukeser.jpg"},
{id:"tilashar",name:"Тілашар",ev:9,url:"/covers/tilashar.jpg"},
{id:"tugan_kun",name:"Туған күн",ev:10,url:"/covers/tugan_kun.jpg"},
{id:"sunset",name:"Закат в саду",url:"/covers/sunset.jpg"},
{id:"palace",name:"Дворец",url:"/covers/palace.jpg"},
{id:"lavender",name:"Лаванда",url:"/covers/lavender.jpg"},
{id:"sparkler",name:"Огни ночи",url:"/covers/sparkler.jpg"},
{id:"blossoms",name:"Сакура",url:"/covers/blossoms.jpg"},
{id:"kazakh",name:"Қазақ ою",url:"/covers/kazakh.jpg"}
];
const ANIMS=[
{id:"auto",name:"По дизайну",icon:"✨",desc:"Под стиль карточки"},
{id:"env",name:"Королевский конверт",icon:"✉️",desc:"Печать и выезжающий билет"},
{id:"doors",name:"Золотые врата",icon:"🚪",desc:"3D распашные створки"},
{id:"scroll",name:"Царский свиток",icon:"📜",desc:"Разворот пергамента"},
{id:"box",name:"Шкатулка с бантом",icon:"🎁",desc:"Крышка и шелковая лента"},
{id:"curtain",name:"Шёлковый занавес",icon:"🎭",desc:"Театральный бархат"},
{id:"heart",name:"Золотое сердце",icon:"💖",desc:"Две половинки сердца"},
{id:"flip",name:"3D Открытка",icon:"🎴",desc:"3D переворот билета"},
{id:"portal",name:"Звёздный портал",icon:"🌌",desc:"Сияющий вихрь света"},
...(globalThis.PhotoOpenings?.catalog||[])
];
const FX_LIST=[
{id:"auto",name:"По дизайну",icon:"🪄"},
{id:"petals",name:"Лепестки роз",icon:"🌸"},
{id:"stars",name:"Звёзды",icon:"⭐"},
{id:"confetti",name:"Конфетти",icon:"🎉"},
{id:"hearts",name:"Сердечки",icon:"💖"},
{id:"dust",name:"Пыльца",icon:"✨"}
];
// [название, стиль, уровень цены, фон, текст, акцент, шрифт, орнамент]
const DG=[["Ретро 70-х","ретро",1,"radial-gradient(circle at 50% 118%,#f4a259 0 22%,#e76f51 22% 36%,#c1440e 36% 50%,transparent 50%),#fdf0d5","#5b2a0a","#c1440e","Lobster","☀","none",0],
["Винтажная бумага","классика",1,"radial-gradient(#f3e6c8,#e2cfa0)","#4a3520","#8b5e34","Lora","❦","flor",0],
["Лён","модерн",1,"#fbfaf6","#222","#9a8c7a","Montserrat","—","none",0],
["Мята","модерн",1,"linear-gradient(#e8f5ef,#d4ebf2)","#2f5d62","#5e8b7e","Comfortaa","❀","wave",0],
["Ар-деко","ретро",2,"repeating-linear-gradient(90deg,#14213d 0 6cqw,#1b2b4f 6cqw 12cqw)","#f1e3b3","#d4af37","Oswald","◆","deco",1],
["Ретро-диннер","ретро",2,"repeating-conic-gradient(#ffe5ec 0 25%,#fff 0 50%) 0 0/12cqw 12cqw","#8c1c3b","#e63946","Pacifico","★","none",0],
["Қазақ оюы","қазақ",2,"radial-gradient(circle at 50% 0,#0e7490,#083344)","#fef3c7","#fbbf24","Lora","❖","kaz",0],
["Ботаника","классика",2,"linear-gradient(#f7fbf2,#e3efd9)","#3b5d3a","#7da36b","Lora","❧","flor",0],
["Праздник","модерн",2,"#fff7ed","#7c2d12","#ea580c","Pacifico","🎈","bal",0],
["Нәресте","модерн",2,"linear-gradient(#fef9c3,#fde68a)","#854d0e","#f59e0b","Comfortaa","☁","wave",0],
["Синтвейв 80-х","ретро",3,"linear-gradient(#1a0536,#5a189a 55%,#ff3d7f)","#fff","#00f0ff","Oswald","▲","stars",0],
["Золото на чёрном","люкс",3,"radial-gradient(circle at 50% 30%,#2b2b2b,#0b0b0b)","#f5e6b8","#d4af37","Lora","✦","deco",1],
["Розовый закат","модерн",3,"linear-gradient(#ffd6e0,#ffb4a2 60%,#e5989b)","#6d2b3d","#b5495b","Caveat","❀","flor",0],
["Небо и облака","модерн",3,"linear-gradient(#cfe8ff,#eaf6ff)","#2b4c7e","#5b8bd6","Comfortaa","☁","wave",0],
["Қазақ алтын","қазақ",3,"linear-gradient(160deg,#7f1d1d,#450a0a)","#fde68a","#f59e0b","Lora","❖","kaz",1],
["Көк шаңырақ","қазақ",3,"linear-gradient(#0ea5e9,#0369a1)","#fff","#fde047","Oswald","☀","kaz",0],
["Пудровая роза","классика",3,"linear-gradient(#fff1f2,#fecdd3)","#881337","#be123c","Caveat","❀","flor",0],
["Лаванда","классика",3,"linear-gradient(#f5f3ff,#ddd6fe)","#4c1d95","#7c3aed","Lora","❦","flor",0],
["Ретро-кино","ретро",3,"radial-gradient(#3b2a20,#16100c)","#f4e4c1","#e0a458","Lobster","✶","deco",1],
["Изумруд","люкс",4,"radial-gradient(circle at 50% 20%,#0f5132,#052e1a)","#f7e7b4","#e6c15a","Lora","♛","flor",1],
["Розовое золото","люкс",4,"linear-gradient(135deg,#f9e4e0,#f3c9c0 50%,#e9b5a8)","#5a2e2e","#b76e79","Lobster","❤","flor",1],
["Ночное небо","люкс",4,"radial-gradient(circle at 20% 10%,#2d1b69,#0b0830 70%)","#f2e9ff","#ffd166","Montserrat","☾","stars",1],
["Императорский","люкс",4,"linear-gradient(135deg,#1e1b4b,#312e81 60%,#4c1d95)","#fef3c7","#fbbf24","Lora","♛","stars",1],
["Солнце 70-х","ретро",4,"repeating-conic-gradient(from 0deg at 50% 100%,#ffe29a 0 7.5deg,#ffd166 7.5deg 15deg)","#5b2a0a","#c1440e","Lobster","☀","wave",0],
["Королевский бордо","люкс",4,"radial-gradient(circle at 50% 25%,#7a1233,#2b0614)","#fde8c8","#e8b86d","Lora","♛","flor",1],
["Аққу","қазақ",3,"radial-gradient(circle at 50% 30%,#ffffff,#f7f3ea 70%,#eee5d3)","#2c2825","#c59b27","Lora","❖","kaz",1],
["Салтанат","люкс",4,"radial-gradient(circle at 50% 20%,#18233c,#080d1a 80%)","#fef6e4","#fbbf24","Oswald","♛","deco",1],
["Тұмар","қазақ",4,"linear-gradient(160deg,#0f4c5c,#092a33 60%,#04151a)","#fffbeb","#f59e0b","Montserrat","✦","kaz",1],
["Жібек жолы","классика",3,"linear-gradient(135deg,#fff8f0,#fae4cf 50%,#f0c9a6)","#451a03","#b45309","Lobster","❧","flor",0],
["Алтын Сарай","люкс",4,"radial-gradient(ellipse at 50% 0%,#262626,#121212 60%,#000000)","#f8fafc","#ffd700","Lora","♛","stars",1]];
const $=s=>document.querySelector(s),esc=s=>String(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])),rub=n=>n.toLocaleString("ru-RU")+" ₸";
const fmt=d=>d?d.split("-").reverse().join("."):"";
const MUSIC_TRACKS=[
{url:"/audio/dombra_kyui.wav",title:"Домбыра күйі"},
{url:"/audio/mahabbat_valsi.wav",title:"Махаббат вальсі"},
{url:"/audio/zhar_zhar.wav",title:"Жар-жар"},
{url:"/audio/kozimnin_qarasy.wav",title:"Көзімнің қарасы"},
{url:"/audio/besik_zhyry.wav",title:"Бесік жыры"},
{url:"/audio/toy_bastar.wav",title:"Тойбастар"}
];
const def=()=>({ev:0,lang:"kz",dsg:0,names:"Арман & Айгерім",hosts:"Ахметовтер әулеті",date:"2026-12-19",time:"18:00",place:"«Алтын сарай» мейрамханасы",addr:"Атырау қ., Азаттық даңғ., 10",text:EV[0][3],te:0,c:{},font:"",frame:"double",photo:"",cover:"",pl:"frame",ps:"circle",pf:"none",sch:"",zone:"Asia/Almaty",lat:"",lng:"",closed:false,closeAt:"",mus:"",musTitle:"",vc:1,paid:0,anim:"auto",fx:"auto"});
const FR={thin:"0.5cqw solid",double:"1.3cqw double",dot:"0.7cqw dotted",thick:"1.4cqw solid",round:"0.6cqw solid"};
// Для каждого дизайна: [узор, эффект, цвет частиц, анимация открытия]
const VX=[["none","rays","#e76f51","flip"],["flor","petals","#a0522d","env"],["none","dust","#b8a98f","zoom"],["wave","clouds","#ffffff","zoom"],["deco","shimmer","#d4af37","env"],["none","confetti","#e63946","flip"],["kaz+steppe","shimmer","#fbbf24","curtain"],["flor","petals","#7da36b","env"],["bal","balloons","#ea580c","zoom"],["wave","clouds","#ffffff","zoom"],["stars","stars","#00f0ff","flip"],["deco","dust","#d4af37","env"],["rose","petals","#c1121f","env"],["wave","clouds","#ffffff","zoom"],["kaz+steppe","dust","#f59e0b","curtain"],["kaz+steppe","shimmer","#fde047","curtain"],["rose","petals","#be123c","env"],["flor","petals","#a78bfa","env"],["deco","shimmer","#e0a458","flip"],["flor","dust","#e6c15a","env"],["flor","petals","#e8a0a8","env"],["stars+moon","stars","#ffd166","flip"],["stars+moon","dust","#fbbf24","env"],["wave","rays","#c1440e","flip"],["rose","petals","#9b1c31","env"],["kaz","petals","#d4af37","scroll"],["deco+stars","dust","#fbbf24","doors"],["kaz+steppe","dust","#f59e0b","curtain"],["flor","petals","#b45309","env"],["stars+moon","stars","#ffd700","portal"]];
const RS=(x,y,s)=>`<g transform="translate(${x} ${y}) scale(${s})">${[0,72,144,216,288].map(a=>`<ellipse cx="0" cy="-8" rx="8.5" ry="10.5" transform="rotate(${a})" fill="var(--rs,#c1121f)" stroke="rgba(0,0,0,.28)" stroke-width=".6"/>`).join("")}${[36,108,180,252,324].map(a=>`<ellipse cx="0" cy="-4.5" rx="6" ry="7.5" transform="rotate(${a})" fill="var(--rs,#c1121f)" stroke="rgba(0,0,0,.3)" stroke-width=".6"/><ellipse cx="0" cy="-5.5" rx="3" ry="3.5" transform="rotate(${a})" fill="rgba(255,255,255,.14)"/>`).join("")}<path d="M0 0c2-3 5-1 4 2s-6 3-8 0 1-8 7-7" fill="none" stroke="rgba(0,0,0,.4)" stroke-width=".9"/></g>`;
const LF=(x,y,r)=>`<ellipse cx="${x}" cy="${y}" rx="11" ry="4.5" transform="rotate(${r} ${x} ${y})" fill="#2f6b3a" opacity=".92"/>`;
const ROSEC=LF(50,22,-10)+LF(22,52,70)+LF(44,50,40)+RS(30,30,1.15)+RS(56,16,.7)+RS(14,56,.7)+RS(46,46,.55);
const STP='<svg class="sc" viewBox="0 0 100 50" preserveAspectRatio="xMidYMax slice"><circle cx="76" cy="14" r="7" fill="currentColor" opacity=".35"/><path d="M0 34 20 18 34 30 52 12 72 32 86 22 100 34V50H0Z" fill="currentColor" opacity=".3"/><path d="M0 40 16 30 34 40 58 28 80 40 100 34V50H0Z" fill="currentColor" opacity=".5"/><path d="M38 50V44Q50 30 62 44V50Z" fill="currentColor"/><rect x="48" y="44" width="4" height="6" fill="rgba(0,0,0,.45)"/><path d="M44 33Q50 27 56 33" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="1"/><path d="M0 46Q25 42 50 47T100 45V50H0Z" fill="currentColor" opacity=".8"/></svg>';
const MOON='<svg class="mn" viewBox="0 0 60 100"><defs><mask id="mm"><rect width="60" height="100" fill="#fff"/><circle cx="49" cy="13" r="6" fill="#000"/></mask></defs><circle cx="46" cy="15" r="7" fill="currentColor" mask="url(#mm)"/><path d="M0 90Q15 82 30 89T60 86V100H0Z" fill="currentColor" opacity=".25"/><path d="M0 95Q18 88 36 94T60 92V100H0Z" fill="currentColor" opacity=".45"/></svg>';
const FXN={hearts:16,petals:12,stars:24,balloons:7,confetti:22,dust:18,clouds:4};
const MN={kz:["ҚАҢТАР","АҚПАН","НАУРЫЗ","СӘУІР","МАМЫР","МАУСЫМ","ШІЛДЕ","ТАМЫЗ","ҚЫРКҮЙЕК","ҚАЗАН","ҚАРАША","ЖЕЛТОҚСАН"],ru:["ЯНВАРЬ","ФЕВРАЛЬ","МАРТ","АПРЕЛЬ","МАЙ","ИЮНЬ","ИЮЛЬ","АВГУСТ","СЕНТЯБРЬ","ОКТЯБРЬ","НОЯБРЬ","ДЕКАБРЬ"]};
const F={none:"none",sepia:"sepia(.8) contrast(1.05)",bw:"grayscale(1) contrast(1.1)",warm:"saturate(1.3) sepia(.2) brightness(1.05)",fade:"contrast(.85) brightness(1.1) saturate(.8)"};
const rg=n=>{let x=n;return()=>(x=(x*9301+49297)%233280)/233280};
const MOTIF='<path d="M20 10C14 2 4 4 4 11s9 7 9 2-4-4-6-1M20 10C26 2 36 4 36 11s-9 7-9 2 4-4 6-1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="20" cy="10" r="1.8" fill="currentColor"/>';
const FLW='<g fill="currentColor"><g transform="translate(26 26)">'+[0,72,144,216,288].map(a=>`<ellipse cx="0" cy="-9" rx="5.5" ry="10" transform="rotate(${a})" opacity=".85"/>`).join("")+'<circle r="4" fill="#fff" opacity=".9"/></g><path d="M30 34C40 52 58 62 82 64C66 52 52 44 42 28z" opacity=".55"/><path d="M34 30C52 38 66 24 76 4C60 14 46 16 36 24z" opacity=".55"/><circle cx="62" cy="12" r="3.5" opacity=".7"/><circle cx="12" cy="66" r="3.5" opacity=".7"/><circle cx="8" cy="50" r="2.2" opacity=".6"/><circle cx="50" cy="8" r="2.2" opacity=".6"/></g>';
const WV='<path d="M0 14Q12 2 25 12T50 12T75 12T100 10V0H0Z" fill="currentColor" opacity=".25"/><path d="M0 8Q12 -2 25 7T50 7T75 7T100 5V0H0Z" fill="currentColor" opacity=".45"/>';
function kit(k){
if(k.includes("+"))return k.split("+").map(kit).join("");
if(k=="rose")return["tl","tr","bl","br"].map(c=>`<svg class="k big ${c}" viewBox="0 0 70 70">${ROSEC}</svg>`).join("");
if(k=="steppe")return STP;
if(k=="moon")return MOON;
if(k=="flor")return["tl","tr","bl","br"].map(c=>`<svg class="k ${c}" viewBox="0 0 100 100">${FLW}</svg>`).join("");
if(k=="kaz")return["t","b"].map(c=>`<svg class="st ${c}" viewBox="0 0 400 20"><defs><pattern id="ko" width="40" height="20" patternUnits="userSpaceOnUse">${MOTIF}</pattern></defs><rect width="400" height="20" fill="url(#ko)"/></svg>`).join("");
if(k=="deco")return["t","b"].map(c=>`<svg class="dk ${c}" viewBox="0 0 200 100"><g fill="none" stroke="currentColor" stroke-width="1.4">${[80,60,40].map(r=>`<path d="M${100-r} 100A${r} ${r} 0 0 1 ${100+r} 100"/>`).join("")}${[...Array(11)].map((_,i)=>{const a=Math.PI*(i+.5)/11;return`<path d="M${100-Math.cos(a)*42} ${100-Math.sin(a)*42}L${100-Math.cos(a)*95} ${100-Math.sin(a)*95}"/>`}).join("")}</g></svg>`).join("");
if(k=="stars"){const r=rg(7);return`<svg class="sp" viewBox="0 0 60 100">${[...Array(26)].map(()=>{const s=.25+r()*.9;return`<path transform="translate(${r()*60} ${r()*100}) scale(${s})" d="M0-6Q0 0 6 0Q0 0 0 6Q0 0-6 0Q0 0 0-6Z" fill="currentColor" opacity="${.4+r()*.6}"/>`}).join("")}</svg>`}
if(k=="bal"){const r=rg(3),C=["#ff6b6b","#ffd166","#4ecdc4","#a78bfa","#f78fb3"];return`<svg class="sp" viewBox="0 0 60 100">${[...Array(34)].map((_,i)=>{const x=r()*60,y=r()*100,c=C[i%5];return i%2?`<circle cx="${x}" cy="${y}" r="${.8+r()*1.4}" fill="${c}"/>`:`<rect x="${x}" y="${y}" width="2.4" height="1.2" fill="${c}" transform="rotate(${r()*180} ${x} ${y})"/>`}).join("")}</svg>`}
if(k=="wave")return`<svg class="wv t" viewBox="0 0 100 24" preserveAspectRatio="none">${WV}</svg><svg class="wv b" viewBox="0 0 100 24" preserveAspectRatio="none">${WV}</svg>`;
return""}
function normalizeState(input){
  const base=def(),raw=input&&typeof input==="object"&&!Array.isArray(input)?input:{};
  const s={...base};
  for(const key of Object.keys(base))if(typeof raw[key]===typeof base[key]&&key!=="c")s[key]=raw[key];
  s.ev=Number.isInteger(s.ev)&&s.ev>=0&&s.ev<EV.length?s.ev:0;
  s.dsg=Number.isInteger(s.dsg)&&s.dsg>=0&&s.dsg<DG.length?s.dsg:0;
  s.lang=["ru","kz"].includes(s.lang)?s.lang:"kz";
  const enums={zone:["Asia/Almaty","Asia/Atyrau","Asia/Aqtau","Asia/Aqtobe","Asia/Oral","Asia/Qyzylorda","Asia/Bishkek","Europe/Moscow","UTC"],font:["",...FN],frame:["none","thin","double","dot","thick","round"],pl:["frame","bg"],ps:["circle","arch","oval","square"],pf:["none","sepia","bw","warm","fade"],anim:["auto",...ANIMS.map(a=>a.id)],fx:FX_LIST.map(f=>f.id)};
  for(const [key,values]of Object.entries(enums))if(!values.includes(s[key]))s[key]=base[key];
  s.c={};for(const key of ["bg","ink","ac"])if(/^#[a-f0-9]{6}$/i.test(raw.c?.[key]||""))s.c[key]=raw.c[key];
  s.bilingual=raw.bilingual===true;s.translations={ru:{},kz:{}};
  for(const lang of ['ru','kz'])for(const [key,max] of [['text',500],['names',80],['hosts',100],['place',100],['addr',150],['sch',1200],['greeting',180],['dressCode',400],['giftNote',500],['contactName',100]])if(typeof raw.translations?.[lang]?.[key]==='string')s.translations[lang][key]=raw.translations[lang][key].slice(0,max);
  s.names=String(s.names).slice(0,80);s.text=String(s.text).slice(0,500);
  s.scene=['none','garden','stars','balloons','ornament'].includes(raw.scene)?raw.scene:'none';
  s.sceneSpeed=['slow','normal','fast'].includes(raw.sceneSpeed)?raw.sceneSpeed:'normal';
  s.sceneDensity=['low','medium','high'].includes(raw.sceneDensity)?raw.sceneDensity:'medium';
  const media=(value,image=false)=>{
    if(typeof value!=="string"||/[\s<>"'\\\u0000-\u001f]/.test(value))return "";
    if(image&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)&&value.length<15000000)return value;
    if(value.length>250)return "";
    if(/^\/(covers|uploads|audio)\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|mp3|wav|m4a|aac|ogg|webm)$/i.test(value))return value;
    try{const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password?url.href:""}catch{return ""}
  };
  s.photo=media(s.photo,true);s.introPhoto=media(raw.introPhoto,true);s.introX=Number.isFinite(raw.introX)?Math.max(0,Math.min(100,raw.introX)):50;s.introY=Number.isFinite(raw.introY)?Math.max(0,Math.min(100,raw.introY)):50;s.cover=s.cover==="none"?"none":media(s.cover);s.mus=s.mus==="none"?"none":media(s.mus);
  s.story=(Array.isArray(raw.story)?raw.story:[]).slice(0,5).map(p=>({src:media(p?.src,true),caption:typeof p?.caption==='string'?p.caption.slice(0,120):'',x:Number.isFinite(p?.x)?Math.max(0,Math.min(100,p.x)):50,y:Number.isFinite(p?.y)?Math.max(0,Math.min(100,p.y)):50,zoom:Number.isFinite(p?.zoom)?Math.max(1,Math.min(2,p.zoom)):1,fit:p?.fit==='cover'?'cover':'contain',duration:Number.isFinite(p?.duration)?Math.max(3,Math.min(15,p.duration)):5})).filter(p=>p.src);
  for(const [field,max] of [['greeting',180],['dressCode',400],['giftNote',500],['contactName',100],['contactPhone',30]])s[field]=typeof raw[field]==='string'?raw[field].slice(0,max):'';
  s.rsvpQuestions=[...new Set((Array.isArray(raw.rsvpQuestions)?raw.rsvpQuestions:[]).filter(k=>['children','diet','transfer'].includes(k)))];
  s.dressColors=(Array.isArray(raw.dressColors)?raw.dressColors:[]).filter(c=>/^#[a-f0-9]{6}$/i.test(c)).slice(0,5);
  s.faq=(Array.isArray(raw.faq)?raw.faq:[]).slice(0,6).map(p=>({q:typeof p?.q==='string'?p.q.slice(0,150):'',a:typeof p?.a==='string'?p.a.slice(0,500):''}));
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s.date))s.date="";
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time))s.time="";
  if(/^(?:[a-f0-9]{8}|[a-f0-9]{32})$/.test(raw.id||""))s.id=raw.id;
  if(/^[a-f0-9]{48}$/.test(raw.tok||""))s.tok=raw.tok;
  return s;
}
function card(s,o={}){s=normalizeState(s);const d=DG[s.dsg],vx=VX[s.dsg]||[d[8],"dust","#fff","env"];
const userBg=(s.photo&&s.pl=="bg")?s.photo:"";
const covUrl=userBg?"":(s.cover==="none"?"":(s.cover||getDefCover(s.ev,s.dsg)||""));
const bgSrc=userBg||covUrl||"";
const bgm=!!bgSrc;
const imageSrc=url=>esc(globalThis.ShaqyruMedia?.coverAsset(url,!!o.thumbnail)||url);
const imageAttributes=o.thumbnail?'loading="lazy" decoding="async"':'decoding="async" fetchpriority="high"';
const ink=s.c.ink||(bgm?"#fff":d[4]),ac=s.c.ac||(bgm?"#f6d98b":d[5]),bg=s.c.bg||d[3],f=s.font||d[6],L=LB[s.lang],dt=(s.date||"").split("-"),fi=F[s.pf]||"none",
emb=s.ev==0?'<svg class="rg" viewBox="0 0 60 36"><g fill="none" stroke="currentColor" stroke-width="3"><circle cx="22" cy="18" r="13"/><circle cx="38" cy="18" r="13"/></g></svg>':`<b class="or">${d[7]}</b>`;
return `<div class="inv${d[2]>2?" an":""}${d[9]?" gold":""}" style="--rs:${vx[2]||"#c1121f"};--ink:${ink};--ac:${ac};background:${bg};font-family:'${f}',serif">${bgSrc?`<img class="bgp" src="${imageSrc(bgSrc)}" data-original="${esc(bgSrc)}" ${imageAttributes} alt="" style="filter:${fi}"><i class="ov"></i>`:kit(vx[0])}${o.nofx?"":fxl(s.fx&&s.fx!=="auto"?s.fx:vx[1],vx[2])}${s.frame!="none"?`<i class="frm" style="border:${FR[s.frame]} ${ac};${s.frame=="round"?"border-radius:6cqw":""}"></i>`:""}${emb}${s.photo&&s.pl!="bg"?`<img class="ph ${s.ps}" src="${imageSrc(s.photo)}" ${imageAttributes} alt="" style="filter:${fi}">`:""}<small class="sb">${EV[s.ev][s.lang=="kz"?0:1]}</small><h2 class="tt">${L.inv}</h2><div class="dv"><i></i>◆<i></i></div><div class="nm">${esc(s.names)}</div><p class="tx">${esc(s.text)}</p>${dt[2]?`<div class="dp"><b>${+dt[2]}</b><div>${MN[s.lang][+dt[1]-1]||""}<br>${dt[0]}${s.time?" · "+esc(s.time):""}</div></div>`:""}<div class="pl">${esc(s.place)}<br><span>${esc(s.addr)}</span></div>${s.hosts?`<div class="ho">${L.h}: ${esc(s.hosts)}</div>`:""}${!s.paid&&!o.free?'<u class="wm">ПРЕВЬЮ</u>':""}</div>`}
function fxl(t,c){const n=FXN[t]||0,r=rg(t.length*13+5);let h="";for(let i=0;i<n;i++)h+=`<span style="left:${(r()*100).toFixed(1)}%;top:${(r()*100).toFixed(1)}%;--d:${(5+r()*7).toFixed(1)}s;--l:-${(r()*12).toFixed(1)}s;--x:${(r()*30-15).toFixed(1)}cqw;--z:${(.6+r()*.9).toFixed(2)};--h:${Math.round(r()*360)}"></span>`;return`<div class="fx fx-${t}" style="--pc:${c}">${h}</div>`}
const reducedMotion=()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function burst(cw,c,t,{controlled=false}={}){
if(reducedMotion())return;
const b=document.createElement("div");b.className="bst bst-"+t;b.style.setProperty("--pc",c);
const r=Math.random,isH=t=="hearts",isS=t=="stars",isC=t=="confetti",isP=t=="petals";
for(let i=0;i<30;i++){
const a=r()*6.283,d=35+r()*75,s=document.createElement("span");
s.style.cssText=`--tx:${(Math.cos(a)*d).toFixed(0)}cqw;--ty:${(Math.sin(a)*d*1.2).toFixed(0)}cqw;--rot:${Math.round(360+r()*720)}deg;animation-delay:${(r()*.22).toFixed(2)}s`;
if(isH)s.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
else if(isS)s.innerHTML='<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
else if(isC){const C=["#ffd166","#ef476f","#06d6a0","#118ab2","#a78bfa","#f78fb3"];s.style.background=C[i%C.length]}
b.appendChild(s);
}
cw.appendChild(b);if(!controlled)setTimeout(()=>b.remove(),2100);return b;
}
function playIn(el,s,{controlled=false}={}){
if(reducedMotion())return;
el.classList.remove("in","flip","pop");void el.offsetWidth;el.classList.add("in","flip");
const x=VX[s.dsg]||[];const partFx=(s.fx&&s.fx!="auto")?s.fx:(x[1]||"dust");
return burst(el,x[2]||s.c.ac||"#fff",partFx,{controlled});
}
let closeLegacyIntro=null;
function showIntro(s,done,{manual=false,controlled}={}){
closeLegacyIntro?.();globalThis.PhotoOpenings?.close();
s=normalizeState(s);
if(globalThis.PhotoOpenings?.catalog.some(a=>a.id===s.anim))return PhotoOpenings.show(s,{done,manual,controlled});
// Explicit previews remain usable when automatic motion is disabled.
if(reducedMotion()&&!manual){document.querySelectorAll(".intro").forEach(el=>el.remove());done&&done();return}
s=normalizeState(s);document.querySelectorAll(".intro").forEach(el=>el.remove());
const d=DG[s.dsg]||DG[0],vx=VX[s.dsg]||VX[0]||[],
k=(s.anim&&s.anim!="auto")?s.anim:(vx[3]||"env"),
partFx=(s.fx&&s.fx!="auto")?s.fx:(vx[1]||"dust"),
partCol=vx[2]||s.c.ac||d[5]||"#fff",
kz=s.lang=="kz",txt=kz?"Ашу":"Открыть",nm=esc(s.names),
evTitle=EV[s.ev][kz?0:1],dtStr=s.date?fmt(s.date):"",
o=document.createElement("div");
o.className="intro intro-"+k;o.toggleAttribute("data-manual-motion",manual);o.style.setProperty("--ac",s.c.ac||d[5]);
const sl=`<button class="seal" type="button"><span class="sl-ic">${d[7]}</span><small>${txt}</small></button>`;
o.innerHTML={
env:`<div class="env"><i class="eb"></i><div class="ect"><small>${evTitle}</small><b>${nm}</b><span class="ect-dt">${dtStr}</span></div><i class="ef"></i><i class="efl"></i>${sl}</div>`,
doors:`<div class="doors-wrap"><div class="door door-l"><div class="dr-patt"></div><div class="dr-hdl"></div></div><div class="door door-r"><div class="dr-patt"></div><div class="dr-hdl"></div></div><div class="dr-mid"><small class="dr-ev">${evTitle}</small><div class="dr-nm">${nm}</div>${sl}</div></div>`,
scroll:`<div class="sc-wrap"><div class="sc-roll sc-top"><i class="sc-k l"></i><i class="sc-bar"></i><i class="sc-k r"></i></div><div class="sc-sheet"><div class="sc-decor">❦ ❖ ❦</div><small>${evTitle}</small><b>${nm}</b><p>${esc(s.place||"Шақыру")}</p><div class="sc-dt">${dtStr}</div></div><div class="sc-roll sc-bot"><i class="sc-k l"></i><i class="sc-bar"></i><i class="sc-k r"></i></div><div class="sc-seal-wrap">${sl}</div></div>`,
box:`<div class="bx-wrap"><div class="bx-box"><div class="bx-card"><small>${evTitle}</small><b>${nm}</b></div></div><div class="bx-lid"><i class="bx-rb v"></i><i class="bx-rb h"></i><div class="bx-bow"><i class="bw l"></i><i class="bw r"></i><i class="bw c"></i></div></div><div class="bx-seal-wrap">${sl}</div></div>`,
curtain:`<i class="cl"></i><i class="cr"></i><div class="ct-top"></div>${sl}`,
heart:`<div class="ht-wrap"><div class="ht-halves"><div class="ht-l"><div class="ht-wing"></div><div class="ht-nm">${esc(s.names.split("&")[0]?.trim()||s.names)}</div></div><div class="ht-r"><div class="ht-wing"></div><div class="ht-nm">${esc(s.names.split("&")[1]?.trim()||"")}</div></div></div><div class="ht-seal-wrap">${sl}</div></div>`,
flip:`<div class="fl"><b>${d[7]}</b><small>${evTitle}</small><span>${nm}</span>${sl}</div>`,
portal:`<div class="pt-wrap"><div class="pt-ring r1"></div><div class="pt-ring r2"></div><div class="pt-ring r3"></div><div class="pt-core"><small>${evTitle}</small><b>${nm}</b></div><div class="pt-seal-wrap">${sl}</div></div>`,
zoom:`<div class="zm"><b>${d[7]}</b><small>${evTitle}</small><span>${nm}</span>${sl}</div>`
}[k]||`<div class="fl"><b>${d[7]}</b><span>${nm}</span>${sl}</div>`;
document.body.appendChild(o);
if(s.introPhoto){const cover=document.createElement('img');cover.className='intro-cover';cover.src=s.introPhoto;cover.alt='';cover.style.objectPosition=`${s.introX}% ${s.introY}%`;o.prepend(cover)}
const previousFocus=document.activeElement;
if(!controlled){o.setAttribute("role","dialog");o.setAttribute("aria-modal","true")}o.setAttribute("aria-label",kz?"Шақыруды ашу":"Открытие приглашения");
const restoreFocus=()=>{const target=previousFocus?.isConnected&&previousFocus!==document.body?previousFocus:document.getElementById("vg");target?.focus({preventScroll:true})};
let opened=false,closed=false,timer;
const complete=()=>{if(!opened){opened=true;done&&done()}};
const close=()=>{if(closed)return;closed=true;clearTimeout(timer);o.remove();closeLegacyIntro=null;complete();if(!controlled)restoreFocus()};
closeLegacyIntro=close;
const start=()=>{
if(opened)return;o.querySelector(".seal").disabled=true;
if(reducedMotion()&&!manual){close();return}
o.classList.add("open");
burst(o,partCol,partFx,{controlled:!!controlled});
if(!controlled){complete();timer=setTimeout(close,2400)}
};
o.querySelector(".seal").onclick=start;
const skip=document.createElement("button");skip.type="button";skip.className="intro-skip";skip.textContent=kz?"Анимацияны өткізу":"Пропустить анимацию";
skip.onclick=close;o.appendChild(skip);
if(!controlled)o.addEventListener("keydown",e=>{if(e.key==="Escape"){e.preventDefault();skip.click()}else if(e.key==="Tab"){const buttons=[...o.querySelectorAll("button:not(:disabled)")];const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
if(controlled)controlled({element:o,start,dispose:close});else o.querySelector(".seal").focus({preventScroll:true});
}
document.addEventListener("pointerdown",e=>{if(reducedMotion())return;const b=e.target.closest(".go,.gh,.ch,.g,.seal");if(!b||b.disabled)return;const r=b.getBoundingClientRect(),s=Math.max(r.width,r.height)*2,d=document.createElement("span");d.className="rip";d.style.cssText=`width:${s}px;height:${s}px;left:${e.clientX-r.left-s/2}px;top:${e.clientY-r.top-s/2}px`;b.appendChild(d);setTimeout(()=>d.remove(),650)});

document.addEventListener("error",event=>{const img=event.target;if(img instanceof HTMLImageElement&&img.dataset.original&&img.src!==new URL(img.dataset.original,location.origin).href){img.src=img.dataset.original;delete img.dataset.original}},true);
