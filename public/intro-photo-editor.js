function mountIntroPhotoEditor(container,{state,onChange}){
  let sequence=0;
  container.classList.add('intro-photo-editor');
  container.innerHTML='<img class="intro-thumbnail" alt=""><div><label for="intro-upload" class="upload-label"></label><input id="intro-upload" type="file" accept="image/jpeg,image/png,image/webp"><p class="upload-hint"></p><label for="intro-x" class="x-label"></label><input id="intro-x" type="range" min="0" max="100" step="1"><label for="intro-y" class="y-label"></label><input id="intro-y" type="range" min="0" max="100" step="1"><button type="button" class="gh intro-remove"></button><p class="intro-feedback" role="status"></p></div>';
  const find=s=>container.querySelector(s),t=(ru,kz)=>state().lang==='kz'?kz:ru;
  function update(){
    const s=state();find('.intro-thumbnail').src=PhotoOpenings.photoFor(s);find('.intro-thumbnail').style.objectPosition=`${s.introX??50}% ${s.introY??50}%`;
    find('.upload-label').textContent=t('Своё фото на заставке','Заставкаға өз фотоңыз');
    find('.upload-hint').textContent=t('JPEG, PNG или WebP до 12 МБ. Без отдельного фото используется фото приглашения или обложка.','12 МБ дейінгі JPEG, PNG немесе WebP. Жеке фото болмаса, шақыру фотосы не мұқабасы қолданылады.');
    find('.x-label').textContent=t('Положение по горизонтали','Көлденең орналасуы');find('.y-label').textContent=t('Положение по вертикали','Тігінен орналасуы');
    find('#intro-x').value=s.introX??50;find('#intro-y').value=s.introY??50;
    find('.intro-remove').textContent=t('Убрать отдельное фото','Жеке фотоны алып тастау');find('.intro-remove').disabled=!s.introPhoto;
  }
  find('#intro-upload').onchange=async e=>{
    const file=e.target.files[0],ticket=++sequence;e.target.value='';if(!file)return;
    find('.intro-feedback').textContent=t('Обрабатываем фото…','Фото өңделуде…');
    try{const photo=await PhotoOpenings.loadPhoto(file);if(ticket!==sequence)return;Object.assign(state(),{introPhoto:photo,introX:50,introY:50});update();onChange();find('.intro-feedback').textContent=t('Фото заставки добавлено','Заставка фотосы қосылды')}
    catch{if(ticket===sequence)find('.intro-feedback').textContent=t('Не удалось открыть фото. Выберите JPEG, PNG или WebP до 12 МБ.','Фото ашылмады. 12 МБ дейінгі JPEG, PNG немесе WebP таңдаңыз.')}
  };
  for(const [id,key]of [['#intro-x','introX'],['#intro-y','introY']])find(id).oninput=e=>{state()[key]=Number(e.target.value);find('.intro-thumbnail').style.objectPosition=`${state().introX??50}% ${state().introY??50}%`;onChange()};
  find('.intro-remove').onclick=()=>{sequence++;Object.assign(state(),{introPhoto:'',introX:50,introY:50});update();onChange();find('.intro-feedback').textContent=t('Используется обложка приглашения','Шақыру мұқабасы қолданылады')};
  update();return {update};
}
