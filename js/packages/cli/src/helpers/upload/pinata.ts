import log from 'loglevel';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import { setImageUrlManifest } from './file-uri';
import path from 'path';

async function sleep(ms: number): Promise<void> {
  console.log('waiting');
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadMedia(media, jwt) {
  const data = new FormData();
  data.append('file', fs.createReadStream(media));

  const res = await fetch(`https://api.pinata.cloud/pinning/pinFileToIPFS`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    method: 'POST',
    body: data,
  });

  const json = await res.json();
  return json.IpfsHash;
}

export async function pinataUpload(
  image: string,
  animation: string,
  manifestBuffer: Buffer,
  jwt: string,
  gateway: string | null,
) {
  const gatewayUrl = gateway ? gateway : `https://ipfs.io`;

  const imageCid = await uploadMedia(image, jwt);
  log.info('uploaded image: ', `${gatewayUrl}/ipfs/${imageCid}`);
  await sleep(500);

  let animationCid = undefined;
  let animationUrl = undefined;
  if (animation) {
    animationCid = await uploadMedia(animation, jwt);
    log.info('uploaded image: ', `${gatewayUrl}/ipfs/${animationCid}`);
  }

  const mediaUrl = `${gatewayUrl}/ipfs/${imageCid}`;
  if (animationCid) {
    animationUrl = `${gatewayUrl}/ipfs/${animationCid}`;
  }

  const manifestJson = await setImageUrlManifest(
    manifestBuffer.toString('utf8'),
    mediaUrl,
    animationUrl,
  );

  const filenameJson = path.basename(image).replace(path.extname(image),".json");

  fs.writeFileSync(filenameJson, JSON.stringify(manifestJson));

  const metadataCid = await uploadMedia(filenameJson, jwt);

  await sleep(500);

  const link = `${gatewayUrl}/ipfs/${metadataCid}`;
  log.info('uploaded manifest: ', link);

  return [link, mediaUrl, animationUrl];
}
