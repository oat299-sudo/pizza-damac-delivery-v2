
// Utility to generate Thai PromptPay QR Payload (EMVCo Standard)

function crc16(data: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    let x = ((crc >> 8) ^ data.charCodeAt(i)) & 0xFF;
    x ^= x >> 4;
    crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return id + len + value;
}

export const generatePromptPayPayload = (phoneNumberOrId: string, amount: number): string => {
  const sanitizeId = phoneNumberOrId.replace(/[^0-9]/g, '');
  let targetId = sanitizeId;

  // Format Target ID (Phone: 0066..., Tax: As is)
  if (sanitizeId.length >= 10 && sanitizeId.startsWith('0')) {
      // Mobile Number: 0994979199 -> 0066994979199
      targetId = '0066' + sanitizeId.substring(1);
  }
  
  const amountStr = amount.toFixed(2);

  // 1. Payload Format Indicator (00)
  let payload = formatField('00', '01');
  // 2. Point of Initiation Method (01) -> 12 (Dynamic) or 11 (Static)
  payload += formatField('01', amount > 0 ? '12' : '11');
  
  // 3. Merchant Account Information (29) -> PromptPay (AID: A000000677010111)
  const merchantInfo = formatField('00', 'A000000677010111') + formatField('01', targetId);
  payload += formatField('29', merchantInfo);
  
  // 4. Country Code (58)
  payload += formatField('58', 'TH');
  // 5. Currency (53) -> 764 (THB)
  payload += formatField('53', '764');
  
  // 6. Amount (54) - Only if amount > 0
  if (amount > 0) {
      payload += formatField('54', amountStr);
  }
  
  // 7. Checksum (63) - Initial placeholder
  payload += '6304';
  
  // Calculate CRC
  const checksum = crc16(payload);
  return payload + checksum;
};
