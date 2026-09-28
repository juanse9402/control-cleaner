import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://npiswrlcungyybvdviuf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5waXN3cmxjdW5neXlidmR2aXVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNDEwMzMsImV4cCI6MjA5MzgxNzAzM30.muEyzJql9viCYuE4HF8fdUytlN63p1AGmi7zpAaPviw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const filePath = "C:\\Users\\Juan Sebastián G\\Downloads\\WhatsApp Chat - Gina Amatxu\\_chat.txt";

if (!fs.existsSync(filePath)) {
  console.error("No se encontró el archivo:", filePath);
  process.exit(1);
}

const rawContent = fs.readFileSync(filePath, 'utf8');

function parseWhatsAppTxt(rawContent) {
  const cleaned = rawContent.replace(/[\u200e\u200f\u202f\u200b\ufeff]/g, ' ');
  const lines = cleaned.split(/\r?\n/);
  const messages = [];
  let currentMsg = null;

  const regex = /^(?:\[|\s*)(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:a\.?\s*m\.?|p\.?\s*m\.?|AM|PM))?)(?:\]|\s*-)\s*(?:([^:]+):\s*)?(.*)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const match = line.match(regex);

    if (match) {
      if (currentMsg) {
        messages.push(currentMsg);
      }

      const dateStr = match[1];
      const timeStr = match[2].trim();
      const senderStr = match[3] ? match[3].trim() : null;
      let bodyStr = match[4] ? match[4].trim() : '';

      let dateIso = null;
      try {
        const parts = dateStr.split(/[\/\.-]/);
        if (parts.length === 3) {
          let day = parts[0].padStart(2, '0');
          let month = parts[1].padStart(2, '0');
          let year = parts[2];
          if (year.length === 2) year = '20' + year;
          dateIso = `${year}-${month}-${day}`;
        }
      } catch (e) {
        dateIso = null;
      }

      currentMsg = {
        timestamp: `${dateStr} ${timeStr}`,
        dateIso,
        sender: senderStr || 'Sistema',
        message: bodyStr,
        isSystem: !senderStr || bodyStr.includes('Los mensajes y las llamadas están cifrados') || bodyStr.includes('cambió el número')
      };
    } else if (currentMsg) {
      currentMsg.message += '\n' + line;
    }
  }

  if (currentMsg) {
    messages.push(currentMsg);
  }

  return messages;
}

async function run() {
  console.log("Procesando chat...");
  const messages = parseWhatsAppTxt(rawContent);
  console.log(`Mensajes parseados: ${messages.length}`);

  const chatTitle = "WhatsApp Chat - Gina Amatxu";
  const { data: existing } = await supabase
    .from('gina_whatsapp_chats')
    .select('id')
    .eq('title', chatTitle);

  if (existing && existing.length > 0) {
    console.log("El chat ya existe en Supabase con ID:", existing[0].id);
    return;
  }

  // Create chat header
  const { data: chatData, error: chatError } = await supabase
    .from('gina_whatsapp_chats')
    .insert([{
      title: chatTitle,
      filename: "_chat.txt",
      total_messages: messages.length
    }])
    .select()
    .single();

  if (chatError) {
    console.error("Error creando encabezado de chat en Supabase:", chatError.message);
    console.log("Asegúrate de haber ejecutado el SQL 'supabase-gina-whatsapp-setup.sql' en el editor SQL de Supabase.");
    return;
  }

  console.log("Chat creado con ID:", chatData.id);

  // Insert messages in batches of 300
  const batchSize = 300;
  for (let i = 0; i < messages.length; i += batchSize) {
    const chunk = messages.slice(i, i + batchSize).map(m => ({
      chat_id: chatData.id,
      timestamp: m.timestamp,
      date_iso: m.dateIso,
      sender: m.sender,
      message: m.message,
      is_system: m.isSystem
    }));

    const { error: msgError } = await supabase
      .from('gina_whatsapp_messages')
      .insert(chunk);

    if (msgError) {
      console.error(`Error en lote ${i} - ${i + batchSize}:`, msgError.message);
    } else {
      console.log(`Insertados ${Math.min(i + batchSize, messages.length)} / ${messages.length} mensajes...`);
    }
  }

  console.log("¡Subida completada con éxito!");
}

run();
