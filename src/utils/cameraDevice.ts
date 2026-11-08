/** Match known standard rear-lens names, never infer a lens from enumeration order.
 * Browsers localize labels and do not expose a portable physical/virtual lens type.
 * Unknown or hidden labels leave the browser's default camera in use.
 */
export function standardRearCameraId(devices: Pick<MediaDeviceInfo, 'kind' | 'deviceId' | 'label'>[]): string | undefined {
  const standardRear = /^(?:(?:back|rear)(?:\s+wide(?:[- ]angle)?)?\s+camera|(?:後置|背面)(?:廣角)?(?:相機|攝影機)|(?:后置|背面)(?:广角)?(?:相机|摄像头)|背面(?:広角)?カメラ|후면 카메라|Rückkamera|Caméra arrière|Cámara trasera|Câmera traseira)$/iu;
  return devices.find(device => device.kind === 'videoinput' && device.deviceId
    && standardRear.test(device.label.trim()))?.deviceId;
}
