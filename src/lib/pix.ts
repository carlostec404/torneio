// Build a PIX "BR Code" (EMV) payload for static QR code.

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildPixPayload(opts: {
  key: string;
  merchantName: string;
  merchantCity: string;
  amount?: number;
  txid?: string;
}): string {
  const { key, merchantName, merchantCity, amount, txid = "***" } = opts;
  const merchantAccount = tlv("00", "br.gov.bcb.pix") + tlv("01", key);

  let payload =
    tlv("00", "01") +
    tlv("26", merchantAccount) +
    tlv("52", "0000") +
    tlv("53", "986") +
    (amount ? tlv("54", amount.toFixed(2)) : "") +
    tlv("58", "BR") +
    tlv("59", merchantName.slice(0, 25)) +
    tlv("60", merchantCity.slice(0, 15)) +
    tlv("62", tlv("05", txid));

  payload += "6304";
  return payload + crc16(payload);
}
