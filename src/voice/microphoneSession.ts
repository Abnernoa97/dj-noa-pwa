let sharedStream: MediaStream | null = null;
let opening: Promise<MediaStream | null> | null = null;

function streamIsLive(stream: MediaStream | null) {
  return Boolean(stream?.getAudioTracks().some((track) => track.readyState === 'live'));
}

export function currentNoahMicrophone() {
  if (!streamIsLive(sharedStream)) sharedStream = null;
  return sharedStream;
}

export async function ensureNoahMicrophone() {
  const current = currentNoahMicrophone();
  if (current) return current;
  if (opening) return opening;
  if (!navigator.mediaDevices?.getUserMedia) return null;

  opening = navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  }).then((stream) => {
    sharedStream = stream;
    return stream;
  }).catch(() => null).finally(() => {
    opening = null;
  });

  return opening;
}

export function stopNoahMicrophone() {
  opening = null;
  sharedStream?.getTracks().forEach((track) => track.stop());
  sharedStream = null;
}
