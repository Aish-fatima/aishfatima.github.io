(function(){
 const status=document.getElementById('status'), loginForm=document.getElementById('loginForm'), uploadArea=document.getElementById('uploadArea'), setupWarning=document.getElementById('setupWarning');
 const url=window.SUPABASE_URL, key=window.SUPABASE_ANON_KEY;
 if(!window.supabase||!url||!key||url.includes('PASTE_')||key.includes('PASTE_')){setupWarning.classList.remove('hidden');setupWarning.textContent='Setup required: add your Supabase Project URL and publishable/anon key in js/supabase-config.js.';loginForm.querySelector('button').disabled=true;return;}
 const client=window.supabase.createClient(url,key);
 function say(s){status.textContent=s;}
 async function refresh(){const {data:{session}}=await client.auth.getSession();loginForm.classList.toggle('hidden',!!session);uploadArea.classList.toggle('hidden',!session);}
 loginForm.addEventListener('submit',async e=>{e.preventDefault();say('Signing in…');const {error}=await client.auth.signInWithPassword({email:document.getElementById('email').value.trim(),password:document.getElementById('password').value});if(error){say('Login failed: '+error.message);return;}say('Signed in.');await refresh();});
 document.getElementById('logoutBtn').addEventListener('click',async()=>{await client.auth.signOut();say('Logged out.');await refresh();});
 document.getElementById('uploadForm').addEventListener('submit',async e=>{e.preventDefault();const {data:{session}}=await client.auth.getSession();if(!session){say('Please log in again.');await refresh();return;}const files=[...document.getElementById('mediaFiles').files];if(!files.length)return;say('Uploading '+files.length+' file(s)…');let done=0;
 for(const file of files){try{if(!file.type.startsWith('image/')&&!file.type.startsWith('video/'))throw new Error('Only image/video files are supported.');const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const path=Date.now()+'-'+crypto.randomUUID()+'-'+safeName;const {error:upErr}=await client.storage.from('gallery-media').upload(path,file,{contentType:file.type,upsert:false});if(upErr)throw upErr;const {data:{publicUrl}}=client.storage.from('gallery-media').getPublicUrl(path);const {error:dbErr}=await client.from('gallery_media').insert({name:file.name,storage_path:path,public_url:publicUrl,media_type:file.type.startsWith('video/')?'video':'image'});if(dbErr)throw dbErr;done++;say('Uploaded '+done+' of '+files.length+'…');}catch(err){say('Stopped after '+done+' file(s). Error: '+err.message+'\nIf file uploaded but database insert failed, it may remain in storage and need cleanup.');return;}}
 document.getElementById('uploadForm').reset();say('Success! '+done+' file(s) published. They should appear in the live gallery after it refreshes.');
 });
 refresh();
})();
