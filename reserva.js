'use strict';
const params=new URLSearchParams(location.search),query=new URLSearchParams({id:params.get('id')||'',token:params.get('token')||''});
const status=document.getElementById('booking-status'),details=document.getElementById('booking-details');
// Keep the capability token out of the visible address/history and referrer headers.
history.replaceState(null,'','/reserva.html');
let attempts=0;
async function check(){
  try {
    const response=await fetch('/api/booking-status?'+query,{cache:'no-store'});
    if(!response.ok)throw Error('status');
    const result=await response.json();
    details.textContent=`${result.name} · ${result.arrival} a ${result.departure} · Total: ${result.total} € · Señal: ${result.deposit} € · Resto al llegar: ${result.balance} €.`;
    if(result.status==='confirmed'){status.textContent='Reserva confirmada. Hemos recibido tu señal del 20 %.';return;}
    if(result.status==='expired'){status.textContent='El plazo de pago ha terminado. Esta solicitud no está confirmada.';return;}
    status.textContent='Tu reserva aún no está confirmada. Estamos esperando la notificación del pago. Si saliste del pago sin completarlo, las fechas se liberarán cuando venza el plazo.';
    if(++attempts<20)setTimeout(check,3000);
  } catch{status.textContent='No podemos comprobar ahora tu reserva. Si has pagado, contacta con nosotros antes de realizar otro pago.';}
}
check();
