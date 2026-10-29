/* Displays only media uploaded to Supabase. Google Drive fetching is disabled. */
(async function(){
 const url=window.SUPABASE_URL,key=window.SUPABASE_ANON_KEY;
 if(!window.supabase||!url||!key||url.includes('PASTE_')||key.includes('PASTE_'))return;
 const isVideo=location.pathname.toLowerCase().endsWith('videos.html');
 const gallery=document.getElementById(isVideo?'googleDriveVideoGallery':'googleDriveGallery');if(!gallery)return;
 try{const sb=window.supabase.createClient(url,key);const {data,error}=await sb.from('gallery_media').select('name,public_url,media_type,created_at').eq('media_type',isVideo?'video':'image').order('created_at',{ascending:false});if(error)throw error;
  for(const m of (data||[])){const item=document.createElement('div');item.className='gallery-item';if(isVideo){const v=document.createElement('video');v.src=m.public_url;v.controls=true;v.preload='metadata';v.playsInline=true;v.style.width='100%';v.style.display='block';item.appendChild(v);}else{const img=document.createElement('img');img.src=m.public_url;img.alt=m.name||'Success Story';img.loading='lazy';img.decoding='async';item.appendChild(img);}gallery.appendChild(item);}
 }catch(e){console.error('Live gallery load error:',e);}
})();
