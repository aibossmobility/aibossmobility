/* Privacy-first Google Live voice pilot. The permanent Google key is never sent to visitors. */
(() => {
  const controls = [...document.querySelectorAll('[data-google-voice]')];
  if (!controls.length) return;
  let active = false, socket = null, microphone = null, inputContext = null,
      outputContext = null, processor = null, source = null, sink = null, deadline = null,
      nextAudioAt = 0;
  const msg = text => controls.forEach(root => {
    const status = root.querySelector('[data-voice-status]');
    if (status) status.textContent = text;
  });
  const update = (ready) => controls.forEach(root => {
    root.querySelector('[data-voice-start]').disabled = !ready || active;
    root.querySelector('[data-voice-stop]').disabled = !active;
  });
  function bytesToB64(bytes) {
    let result = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      result += String.fromCharCode(...bytes.subarray(i,i+8192));
    }
    return btoa(result);
  }
  function downsample(samples, inputRate) {
    const ratio = inputRate / 16000;
    const result = new Uint8Array(Math.floor(samples.length / ratio) * 2);
    const view = new DataView(result.buffer);
    for (let i=0; i<result.length/2; i++) {
      const v=Math.max(-1,Math.min(1,samples[Math.floor(i*ratio)]||0));
      view.setInt16(i*2,v<0?v*32768:v*32767,true);
    }
    return result;
  }
  async function playAudio(b64) {
    if (!outputContext) outputContext = new AudioContext();
    if (outputContext.state==='suspended') await outputContext.resume();
    const decoded = atob(b64);
    const frames=Math.floor(decoded.length/2);
    const buffer=outputContext.createBuffer(1,frames,24000);
    const channel=buffer.getChannelData(0);
    for(let i=0;i<frames;i++) {
      let value=decoded.charCodeAt(i*2)|(decoded.charCodeAt(i*2+1)<<8);
      if(value>32767)value-=65536;
      channel[i]=value/32768;
    }
    const sound=outputContext.createBufferSource();
    sound.buffer=buffer; sound.connect(outputContext.destination);
    const startAt=Math.max(outputContext.currentTime+.03,nextAudioAt);
    sound.start(startAt);
    nextAudioAt=startAt+buffer.duration;
  }
  function stop() {
    clearTimeout(deadline);
    active=false;
    if(socket){const old=socket;socket=null;try{old.close();}catch{}}
    if(processor){processor.onaudioprocess=null;processor.disconnect();processor=null;}
    if(source){source.disconnect();source=null;}
    if(sink){sink.disconnect();sink=null;}
    if(microphone){microphone.getTracks().forEach(t=>t.stop());microphone=null;}
    if(inputContext){inputContext.close().catch(()=>{});inputContext=null;}
    if(outputContext){outputContext.close().catch(()=>{});outputContext=null;nextAudioAt=0;}
    update(true);
  }
  async function start(root){
    if(active)return;
    const adult=root.querySelector('[data-voice-adult]').checked;
    const consent=root.querySelector('[data-voice-consent]').checked;
    if(!adult||!consent){msg('Please confirm both the age requirement and the Google privacy notice.');return;}
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){msg('Voice requires a secure browser and microphone access.');return;}
    active=true;update(false);
    msg('Requesting microphone permission…');
    try{
      microphone=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      msg('Connecting to the free Google voice pilot…');
      const response=await fetch('/api/gemini-voice/session',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({isAdult:true,agreeToGoogleReview:true})
      });
      const body=await response.json();
      if(!response.ok||!body.ok)throw new Error(body.error||'The free voice pilot is unavailable.');
      const endpoint='wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token='+encodeURIComponent(body.token);
      socket=new WebSocket(endpoint);
      socket.onopen=()=>{
        socket.send(JSON.stringify({setup:{
          model:body.model,
          generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:'Puck'}}}},
          systemInstruction:{parts:[{text:
            "You are Brian's clearly identified AI Digital Twin for AI Boss Mobility, not the real Brian speaking live. Speak with a calm, supportive, concise and practical tone. Help adult visitors learn practical AI and business workflows through interactive questions and examples. Explain one useful next step at a time. Do not request private records, financial details, passwords or medical information. Do not offer paid work, charge visitors, promise outcomes or send communications. Custom services require Brian's review and a written estimate/agreement. If a human meeting is appropriate, suggest the site's Google booking link. For fatherhood-specific questions, mention papalifecoach.com. Avoid giving individualized legal, financial or medical advice."}]}
        }}));
      };
      socket.onmessage=async event=>{
        // Google Live can send either text or binary JSON websocket messages.
        let packet;
        try {
          const raw=event.data instanceof Blob ? await event.data.text() :
            event.data instanceof ArrayBuffer ? new TextDecoder().decode(event.data) : event.data;
          packet=JSON.parse(raw);
        }catch{return;}
        if(packet.error){msg('Google could not complete this voice session. Please try the alternate assistant.');stop();return;}
        if(packet.setupComplete){
          inputContext=new AudioContext();
          source=inputContext.createMediaStreamSource(microphone);
          processor=inputContext.createScriptProcessor(2048,1,1);
          sink=inputContext.createGain();sink.gain.value=0;
          source.connect(processor);processor.connect(sink);sink.connect(inputContext.destination);
          processor.onaudioprocess=e=>{
            if(!socket||socket.readyState!==WebSocket.OPEN)return;
            const pcm=downsample(e.inputBuffer.getChannelData(0),inputContext.sampleRate);
            if(pcm.length)socket.send(JSON.stringify({realtimeInput:{audio:{data:bytesToB64(pcm),mimeType:'audio/pcm;rate=16000'}}}));
          };
          msg('Connected. Speak naturally to Brian’s AI Digital Twin. Use headphones if possible.');
        }
        const parts=packet.serverContent?.modelTurn?.parts||[];
        for(const part of parts){
          if(part.inlineData?.data && part.inlineData?.mimeType?.startsWith('audio/')){
            await playAudio(part.inlineData.data).catch(()=>{});
          }
        }
        if(packet.serverContent?.outputTranscription?.text){
          msg('AI response: '+packet.serverContent.outputTranscription.text.slice(0,300));
        }
      };
      socket.onerror=()=>msg('Google could not connect this voice session. Please use the alternate conversation or try later.');
      socket.onclose=()=>{if(active){stop();msg('Voice conversation ended. No additional session started.');}};
      deadline=setTimeout(()=>{stop();msg('The two-minute free voice session has ended.');},Math.min(120,body.maxSessionSeconds||120)*1000);
    }catch(error){
      stop();
      msg(error?.message||'Voice is not available. No payment is required.');
    }
  }
  controls.forEach(root=>{
    root.querySelector('[data-voice-start]').addEventListener('click',()=>start(root));
    root.querySelector('[data-voice-stop]').addEventListener('click',()=>{stop();msg('Conversation ended.');});
  });
  fetch('/api/gemini-voice/status',{cache:'no-store'}).then(r=>r.json()).then(result=>{
    update(Boolean(result.available));
    msg(result.available ? 'Ready. Confirm the privacy notice, then start a two-minute voice session.' :
      'The Google free voice pilot is being prepared. No paid account is required. Existing conversation options remain below.');
  }).catch(()=>{update(false);msg('Free voice availability could not be checked.');});
  addEventListener('pagehide',stop);
})();
