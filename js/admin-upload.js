(function(){
 const status=document.getElementById('status'), loginForm=document.getElementById('loginForm'), uploadArea=document.getElementById('uploadArea'), setupWarning=document.getElementById('setupWarning'), mediaList=document.getElementById('mediaList'), mediaControls=document.getElementById('mediaControls'), selectAll=document.getElementById('selectAllMedia'), deleteSelectedBtn=document.getElementById('deleteSelectedBtn');
 const url=window.SUPABASE_URL, key=window.SUPABASE_ANON_KEY;
 if(!window.supabase||!url||!key||url.includes('PASTE_')||key.includes('PASTE_')){setupWarning.classList.remove('hidden');setupWarning.textContent='Setup required: add your Supabase Project URL and publishable/anon key in js/supabase-config.js.';loginForm.querySelector('button').disabled=true;return;}
 const client=window.supabase.createClient(url,key);
 function say(s){status.textContent=s;}
 function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 function syncSelection(){
   const checks=[...mediaList.querySelectorAll('.media-select')];
   const selected=checks.filter(c=>c.checked).length;
   deleteSelectedBtn.disabled=selected===0;
   deleteSelectedBtn.textContent=selected ? 'Delete selected ('+selected+')' : 'Delete selected';
   selectAll.checked=checks.length>0 && selected===checks.length;
   selectAll.indeterminate=selected>0 && selected<checks.length;
 }
 async function deleteItems(items){
   if(!items.length)return;
   const label=items.length===1?'this item':items.length+' selected items';
   if(!window.confirm('Permanently delete '+label+' from the live gallery? This cannot be undone.'))return;
   say('Deleting '+items.length+' item(s)…');
   deleteSelectedBtn.disabled=true;
   const {error:storageError}=await client.storage.from('gallery-media').remove(items.map(x=>x.storage_path));
   if(storageError){say('Could not delete storage file(s): '+storageError.message+' Check the Storage delete policy.');syncSelection();return;}
   const ids=items.map(x=>Number(x.id));
   const {error:rowError}=await client.from('gallery_media').delete().in('id',ids);
   if(rowError){say('Storage files were removed, but gallery records could not be deleted: '+rowError.message+' Check the table DELETE policy.');await loadMedia();return;}
   say('Deleted '+items.length+' item(s) successfully.');
   await loadMedia();
 }
 async function loadMedia(){
   mediaList.innerHTML='<p class="text-muted">Loading media…</p>';
   const {data,error}=await client.from('gallery_media').select('id,name,storage_path,media_type,created_at').order('created_at',{ascending:false});
   if(error){mediaControls.classList.add('hidden');mediaList.innerHTML='<p class="text-danger">Could not load media: '+escapeHtml(error.message)+'</p>';return;}
   if(!data.length){mediaControls.classList.add('hidden');mediaList.innerHTML='<p class="text-muted">No uploaded photos or videos yet.</p>';return;}
   mediaControls.classList.remove('hidden');
   selectAll.checked=false;selectAll.indeterminate=false;
   mediaList.innerHTML=data.map(item=>'<div class="media-item"><div class="media-name"><label><input type="checkbox" class="form-check-input media-select" data-id="'+item.id+'" aria-label="Select '+escapeHtml(item.name)+'"> <span class="badge text-bg-light me-1">'+(item.media_type==='video'?'Video':'Photo')+'</span>'+escapeHtml(item.name)+'</label></div><button type="button" class="btn btn-outline-danger btn-sm delete-btn" data-id="'+item.id+'" data-path="'+escapeHtml(item.storage_path)+'" data-name="'+escapeHtml(item.name)+'">Delete</button></div>').join('');
   mediaList.querySelectorAll('.media-select').forEach(c=>c.addEventListener('change',syncSelection));
   mediaList.querySelectorAll('.delete-btn').forEach(btn=>btn.addEventListener('click',async()=>{
     const item=data.find(x=>String(x.id)===btn.dataset.id);
     if(item)await deleteItems([item]);
   }));
   syncSelection();
 }
 selectAll.addEventListener('change',()=>{mediaList.querySelectorAll('.media-select').forEach(c=>c.checked=selectAll.checked);syncSelection();});
 deleteSelectedBtn.addEventListener('click',async()=>{
   const ids=[...mediaList.querySelectorAll('.media-select:checked')].map(c=>Number(c.dataset.id));
   const {data,error}=await client.from('gallery_media').select('id,name,storage_path,media_type').in('id',ids);
   if(error){say('Could not identify selected media: '+error.message);return;}
   await deleteItems(data||[]);
 });
 async function refresh(){const {data:{session}}=await client.auth.getSession();loginForm.classList.toggle('hidden',!!session);uploadArea.classList.toggle('hidden',!session);if(session)await loadMedia();else {mediaControls.classList.add('hidden');mediaList.innerHTML='<p class="text-muted">Log in to view uploaded media.</p>';}}
 loginForm.addEventListener('submit',async e=>{e.preventDefault();say('Signing in…');const {error}=await client.auth.signInWithPassword({email:document.getElementById('email').value.trim(),password:document.getElementById('password').value});if(error){say('Login failed: '+error.message);return;}say('Signed in.');await refresh();});
 document.getElementById('logoutBtn').addEventListener('click',async()=>{await client.auth.signOut();say('Logged out.');await refresh();});
 document.getElementById('uploadForm').addEventListener('submit',async e=>{e.preventDefault();const {data:{session}}=await client.auth.getSession();if(!session){say('Please log in again.');await refresh();return;}const files=[...document.getElementById('mediaFiles').files];if(!files.length)return;say('Uploading '+files.length+' file(s)…');let done=0;
 for(const file of files){try{if(!file.type.startsWith('image/')&&!file.type.startsWith('video/'))throw new Error('Only image/video files are supported.');const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const path=Date.now()+'-'+crypto.randomUUID()+'-'+safeName;const {error:upErr}=await client.storage.from('gallery-media').upload(path,file,{contentType:file.type,upsert:false});if(upErr)throw upErr;const {data:{publicUrl}}=client.storage.from('gallery-media').getPublicUrl(path);const {error:dbErr}=await client.from('gallery_media').insert({name:file.name,storage_path:path,public_url:publicUrl,media_type:file.type.startsWith('video/')?'video':'image'});if(dbErr)throw dbErr;done++;say('Uploaded '+done+' of '+files.length+'…');}catch(err){say('Stopped after '+done+' file(s). Error: '+err.message+'\nIf file uploaded but database insert failed, it may remain in storage and need cleanup.');return;}}
 document.getElementById('uploadForm').reset();say('Success! '+done+' file(s) published.');await loadMedia();
 });
 refresh();
})();
