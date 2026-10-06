document.querySelectorAll('.date-inquiry').forEach(form=>{
  const arrival=form.elements.arrival,departure=form.elements.departure,status=form.querySelector('.date-error');
  const submit=form.querySelector('button[type="submit"]'), next=form.querySelector('.booking-next'), quote=form.querySelector('.booking-quote');
  const pay=document.createElement('button');pay.type='button';pay.className='button button-primary';pay.textContent='Pagar señal del 20 %';pay.hidden=true;next.after(pay);
  let paymentSelection=null;
  pay.addEventListener('click',async()=>{
    if(!paymentSelection)return;
    pay.disabled=true;status.textContent='Preparando el pago seguro…';
    try{
      const response=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(paymentSelection)});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||'No se ha podido iniciar el pago.');
      const url=new URL(data.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw Error('Enlace de pago incorrecto');
      location.assign(url.href);
    }catch(error){status.textContent=error.message;pay.disabled=false;}
  });
  const today=()=>{const now=new Date();return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10)};
  arrival.min=today();departure.min=today();
  const reset=()=>{paymentSelection=null;pay.hidden=true;pay.disabled=false;next.hidden=true;next.removeAttribute('href');quote.hidden=true;quote.textContent='';status.textContent='';status.className='date-error'};
  arrival.addEventListener('change',()=>{reset();if(!arrival.value)return;const day=new Date(arrival.value+'T12:00:00');day.setDate(day.getDate()+3);departure.min=day.toISOString().slice(0,10);if(departure.value&&departure.value<departure.min)departure.value=''});
  departure.addEventListener('change',reset);
  form.elements.guests.addEventListener('change',reset);
  form.addEventListener('submit',async event=>{
    event.preventDefault();reset();
    const nights=(Date.parse(departure.value)-Date.parse(arrival.value))/86400000;
    if(!arrival.value||!departure.value||arrival.value<today()||!Number.isInteger(nights)||nights<3||nights>90){status.textContent='Selecciona una estancia de al menos 3 noches (máximo 90).';return}
    const selected={arrival:arrival.value,departure:departure.value,guests:form.elements.guests.value};
    submit.disabled=true;submit.textContent='Comprobando calendarios…';status.textContent='Consultando Booking y Airbnb…';
    try{
      const query=new URLSearchParams({apartment:form.dataset.calendar,arrival:selected.arrival,departure:selected.departure});
      const response=await fetch('/api/availability?'+query,{cache:'no-store'});
      if(!response.ok)throw Error('calendar');
      const result=await response.json();
      if(arrival.value!==selected.arrival||departure.value!==selected.departure||form.elements.guests.value!==selected.guests)return;
      if(!result.available){status.textContent='Estas fechas aparecen ocupadas. Elige otras fechas.';return}
      if(!Number.isInteger(result.nights)||result.nights<3||!Number.isSafeInteger(result.total)||!Number.isSafeInteger(result.nightlyRate)||result.deposit!==result.total/5||result.balance!==result.total*4/5)throw Error('quote');
      quote.textContent=`${result.nights} noche${result.nights===1?'':'s'} × ${result.nightlyRate} € = ${result.total} €. Señal del 20 % al confirmar: ${result.deposit} €. Resto del 80 % al llegar: ${result.balance} €. Devolución íntegra de la señal del 20 % si cancelas hasta el ${new Date(result.cancellationDeadline+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}. Después de esa fecha se pierde únicamente la señal del 20 %; no se cobra el 80 % restante.`;
      quote.hidden=false;
      const message=`Hola, quiero solicitar una reserva directa para ${form.dataset.apartment}. Llegada: ${selected.arrival}. Salida: ${selected.departure} (${result.nights} noche${result.nights===1?'':'s'}). Huéspedes: ${selected.guests}. Precio: ${result.total} € (${result.nightlyRate} €/noche). Señal del 20 % al confirmar: ${result.deposit} €; 80 % al llegar: ${result.balance} €. Cancelación con al menos 15 días de antelación: devolución íntegra de la señal del 20 %. Con menos de 15 días de antelación, se pierde únicamente la señal del 20 %; no se cobra el 80 % restante. ¿Me confirmas la reserva y cómo pagar la señal?`;
      next.href='https://wa.me/34607511354?text='+encodeURIComponent(message);
      next.hidden=false;
      if(result.checkoutEnabled===true){paymentSelection={apartment:form.dataset.calendar,...selected,guests:Number(selected.guests)};pay.hidden=false;}
      status.textContent=result.checkoutEnabled===true?'Fechas libres según los calendarios consultados. Paga la señal para confirmar tu reserva o solicita ayuda por WhatsApp.':'Fechas libres según los calendarios consultados. Envía tu solicitud para confirmar precio y reserva.';
      status.className='date-error date-success';
    }catch{status.textContent='No se puede comprobar ahora la disponibilidad. Inténtalo de nuevo más tarde o escríbenos por WhatsApp.'}
    finally{submit.disabled=false;submit.textContent='Comprobar disponibilidad'}
  });
});
const dialog=document.querySelector('.lightbox');if(dialog){document.querySelectorAll('[data-full]').forEach(button=>button.addEventListener('click',()=>{const image=dialog.querySelector('img');image.src=button.dataset.full;image.alt=button.querySelector('img').alt;dialog.showModal()}));dialog.querySelector('.lightbox-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()})}

