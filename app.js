document.querySelectorAll('.date-inquiry').forEach(form=>{
  const arrival=form.elements.arrival,departure=form.elements.departure,error=form.querySelector('.date-error');
  const today=()=>{const now=new Date();return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10)};
  arrival.min=today();departure.min=today();
  arrival.addEventListener('change',()=>{if(!arrival.value)return;const next=new Date(arrival.value+'T12:00:00');next.setDate(next.getDate()+1);departure.min=next.toISOString().slice(0,10);if(departure.value&&departure.value<departure.min)departure.value=''});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!arrival.value||!departure.value||arrival.value<today()||departure.value<=arrival.value){error.textContent='Selecciona una llegada y una salida posterior.';return}
    error.textContent='Comprobando las fechas…';
    try{const query=new URLSearchParams({apartment:form.dataset.calendar,arrival:arrival.value,departure:departure.value});const response=await fetch('/api/availability?'+query,{cache:'no-store'});if(!response.ok)throw Error('calendar');const result=await response.json();if(!result.available){error.textContent='Estas fechas aparecen ocupadas. Prueba otras fechas o consúltanos por WhatsApp.';return}error.textContent=''}catch{error.textContent='No hemos podido comprobar ahora la ocupación. Te confirmaremos las fechas por WhatsApp.'}
    const message=`Hola, quiero consultar ${form.dataset.apartment} del ${arrival.value} al ${departure.value} para ${form.elements.guests.value} persona(s). La reserva queda pendiente de confirmación.`;
    window.location.href='https://wa.me/34607511354?text='+encodeURIComponent(message);
  });
});
const dialog=document.querySelector('.lightbox');if(dialog){document.querySelectorAll('[data-full]').forEach(button=>button.addEventListener('click',()=>{const image=dialog.querySelector('img');image.src=button.dataset.full;image.alt=button.querySelector('img').alt;dialog.showModal()}));dialog.querySelector('.lightbox-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()})}
