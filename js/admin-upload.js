(function(){
 const status=document.getElementById('status'), loginForm=document.getElementById('loginForm'), uploadArea=document.getElementById('uploadArea'), setupWarning=document.getElementById('setupWarning'), mediaList=document.getElementById('mediaList');
 const url=window.SUPABASE_URL, key=window.SUPABASE_ANON_KEY;
 if(!window.supabase||!url||!key||url.includes('PASTE_')||key.includes('PASTE_')){setupWarning.classList.remove('hidden');setupWarning.textContent='Setup required: add your Supabase Project URL and publishable/anon key in js/supabase-config.js.';loginForm.querySelector('button').disabled=true;return;}
 const client=window.supabase.createClient(url,key);
 function say(s){status.textContent=s;}
 function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 async function loadMedia(){
   mediaList.innerHTML='<p class="text-muted">Loading media…</p>';
   const {data,error}=await client.from('gallery_media').select('id,name,storage_path,media_type,created_at').order('created_at',{ascending:false});
   if(error){mediaList.innerHTML='<p class="text-danger">Could not load media: '+escapeHtml(error.message)+'</p>';return;}
   if(!data.length){mediaList.innerHTML='<p class="text-muted">No uploaded photos or videos yet.</p>';return;}
   mediaList.innerHTML=data.map(item=>'<div class="media-item"><div class="media-name"><span class="badge text-bg-light me-1">'+(item.media_type==='video'?'Video':'Photo')+'</span>'+escapeHtml(item.name)+'</div><button type="button" class="btn btn-outline-danger btn-sm delete-btn" data-id="'+item.id+'" data-path="'+escapeHtml(item.storage_path)+'" data-name="'+escapeHtml(item.name)+'">Delete</button></div>').join('');
   mediaList.querySelectorAll('.delete-btn').forEach(btn=>btn.addEventListener('click',async()=>{
     const name=btn.dataset.name;
     if(!window.confirm('Permanently delete "'+name+'" from the website? This cannot be undone.'))return;
     btn.disabled=true;btn.textContent='Deleting…';say('Deleting '+name+'…');
     const {error:storageError}=await client.storage.from('gallery-media').remove([btn.dataset.path]);
     if(storageError){say('Could not delete file: '+storageError.message+' Check the delete policy setup.');btn.disabled=false;btn.textContent='Delete';return;}
     const {error:rowError}=await client.from('gallery_media').delete().eq('id',Number(btn.dataset.id));
     if(rowError){say('File was removed from storage, but its gallery record could not be deleted: '+rowError.message);await loadMedia();return;}
     say('Deleted successfully.');await loadMedia();
   }));
 }
 async function refresh(){const {data:{session}}=await client.auth.getSession();loginForm.classList.toggle('hidden',!!session);uploadArea.classList.toggle('hidden',!session);if(session)await loadMedia();else mediaList.innerHTML='<p class="text-muted">Log in to view uploaded media.</p>';}
 loginForm.addEventListener('submit',async e=>{e.preventDefault();say('Signing in…');const {error}=await client.auth.signInWithPassword({email:document.getElementById('email').value.trim(),password:document.getElementById('password').value});if(error){say('Login failed: '+error.message);return;}say('Signed in.');await refresh();});
 document.getElementById('logoutBtn').addEventListener('click',async()=>{await client.auth.signOut();say('Logged out.');await refresh();});
 document.getElementById('uploadForm').addEventListener('submit',async e=>{e.preventDefault();const {data:{session}}=await client.auth.getSession();if(!session){say('Please log in again.');await refresh();return;}const files=[...document.getElementById('mediaFiles').files];if(!files.length)return;say('Uploading '+files.length+' file(s)…');let done=0;
 for(const file of files){try{if(!file.type.startsWith('image/')&&!file.type.startsWith('video/'))throw new Error('Only image/video files are supported.');const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const path=Date.now()+'-'+crypto.randomUUID()+'-'+safeName;const {error:upErr}=await client.storage.from('gallery-media').upload(path,file,{contentType:file.type,upsert:false});if(upErr)throw upErr;const {data:{publicUrl}}=client.storage.from('gallery-media').getPublicUrl(path);const {error:dbErr}=await client.from('gallery_media').insert({name:file.name,storage_path:path,public_url:publicUrl,media_type:file.type.startsWith('video/')?'video':'image'});if(dbErr)throw dbErr;done++;say('Uploaded '+done+' of '+files.length+'…');}catch(err){say('Stopped after '+done+' file(s). Error: '+err.message+'\nIf file uploaded but database insert failed, it may remain in storage and need cleanup.');return;}}
 document.getElementById('uploadForm').reset();say('Success! '+done+' file(s) published.');await loadMedia();
 });
 refresh();
})();
