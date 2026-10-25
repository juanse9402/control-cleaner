import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  MessageSquare,
  Search,
  Upload,
  Trash2,
  CloudUpload,
  FileText,
  X,
  Calendar,
  Copy,
  Check,
  HelpCircle,
  MoreVertical,
  Download,
  AlertCircle,
  CheckCheck,
  RefreshCw,
  FolderOpen,
  ArrowLeft,
  ArrowUpDown,
  Heart,
  Maximize2,
  Send,
  Mail,
  Inbox,
  Feather,
  Sparkles,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import bannerImg from '../assets/gina-chat-banner.jpg';


/**
 * Parses raw WhatsApp .txt export content into structured message objects
 */
function parseWhatsAppTxt(txtContent) {
  const cleaned = txtContent.replace(/[\u200e\u200f\u202f\u200b\ufeff]/g, ' ');
  const lines = cleaned.split(/\r?\n/);
  const messages = [];
  let currentMsg = null;

  // Regex patterns for WhatsApp export lines
  // Android format: 28/09/2026, 14:30 - Sender: Message OR 28/09/26, 2:30 p. m. - Sender: Message
  const androidRegex = /^(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:a\.?\s*m\.?|p\.?\s*m\.?|AM|PM))?)\s*-\s*(?:([^:]+):\s*)?(.*)$/i;

  // iOS format: [28/09/2026, 14:30:15] Sender: Message
  const iosRegex = /^\[(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:a\.?\s*m\.?|p\.?\s*m\.?|AM|PM))?)\]\s*(?:([^:]+):\s*)?(.*)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const androidMatch = line.match(androidRegex);
    const iosMatch = line.match(iosRegex);
    const match = androidMatch || iosMatch;

    if (match) {
      // Save previous accumulated message if exists
      if (currentMsg) {
        messages.push(currentMsg);
      }

      const dateStr = match[1];
      const timeStr = match[2];
      const senderStr = match[3] ? match[3].trim() : null;
      const bodyStr = match[4] ? match[4].trim() : '';

      // Parse ISO date helper
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
        id: `msg-${i}-${Date.now()}`,
        timestamp: `${dateStr} ${timeStr}`,
        dateIso: dateIso,
        sender: senderStr || 'Sistema',
        message: bodyStr,
        isSystem: !senderStr || bodyStr.includes('Los mensajes y las llamadas están cifrados') || bodyStr.includes('cambió el número') || bodyStr.includes('se unió usando')
      };
    } else if (currentMsg) {
      // Continuation line for multiline message
      currentMsg.message += '\n' + line;
    }
  }

  if (currentMsg) {
    messages.push(currentMsg);
  }

  return messages;
}

export default function GinaWhatsAppView({ onBack }) {
  const [chatsList, setChatsList] = useState([]);

  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSender, setSelectedSender] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' (lo más reciente primero) | 'asc' (lo más antiguo primero)
  const [visibleCount, setVisibleCount] = useState(150);

  // UI State
  const [copiedId, setCopiedId] = useState(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [rawParsedData, setRawParsedData] = useState(null);
  const [currentFileName, setCurrentFileName] = useState('');

  // Paloma Mensajera State (Enviar / Recibir Paloma)
  const [palomasList, setPalomasList] = useState(() => {
    try {
      const saved = localStorage.getItem('palomas_mensajeras_history');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Error reading palomas from localStorage:', e);
    }
    return [
      {
        id: 'paloma-init-1',
        sender: 'Juan Sebastián',
        recipient: 'Gina',
        message: 'Como sé que no puedes tener nuestro chat, acá te dejo este rincón para que suspires como yo lo hago por cada vez que leo nuestras líneas, escucho nuestros audios o sueño viendo nuestras fotos. Algunos caminos también se viven en el corazón... A donde sea, siempre contigo. ❤️',
        created_at: new Date().toISOString(),
        status: 'entregada'
      }
    ];
  });

  const [showEnviarPalomaModal, setShowEnviarPalomaModal] = useState(false);
  const [showRecibirPalomaModal, setShowRecibirPalomaModal] = useState(false);
  const [showPalomasHistory, setShowPalomasHistory] = useState(false);
  const [latestReceivedPaloma, setLatestReceivedPaloma] = useState(null);

  const [palomaSender, setPalomaSender] = useState('Juan Sebastián');
  const [palomaRecipient, setPalomaRecipient] = useState('Gina');
  const [palomaMessage, setPalomaMessage] = useState('');
  const [isSendingPaloma, setIsSendingPaloma] = useState(false);
  const [isReceivingPaloma, setIsReceivingPaloma] = useState(false);
  const [palomaNotification, setPalomaNotification] = useState('');

  const chatContainerRef = useRef(null);

  // Sync Palomas with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('palomas_mensajeras_history', JSON.stringify(palomasList));
    } catch (e) {
      console.warn('Error saving palomas to localStorage:', e);
    }
  }, [palomasList]);

  // Fetch Palomas from Supabase on mount
  useEffect(() => {
    fetchSavedChats();
    fetchPalomasFromSupabase();
  }, []);

  const fetchPalomasFromSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from('gina_palomas')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        setPalomasList(prev => {
          const map = new Map();
          data.forEach(item => map.set(item.id, item));
          prev.forEach(item => {
            if (!map.has(item.id)) map.set(item.id, item);
          });
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
          );
        });
      }
    } catch (err) {
      console.log('Supabase palomas fetch error/fallback:', err);
    }
  };

  const handleSendPaloma = async (e) => {
    e?.preventDefault();
    if (!palomaMessage.trim()) {
      alert('Por favor escribe un mensaje para la paloma mensajera.');
      return;
    }

    setIsSendingPaloma(true);

    const newPaloma = {
      id: `paloma-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sender: palomaSender,
      recipient: palomaRecipient,
      message: palomaMessage.trim(),
      created_at: new Date().toISOString(),
      status: 'entregada'
    };

    // Try saving to Supabase
    try {
      await supabase.from('gina_palomas').insert([
        {
          id: newPaloma.id,
          sender: newPaloma.sender,
          recipient: newPaloma.recipient,
          message: newPaloma.message,
          created_at: newPaloma.created_at,
          status: newPaloma.status
        }
      ]);
    } catch (err) {
      console.log('Supabase insert failed, keeping locally:', err);
    }

    // Always update local list & storage
    setPalomasList(prev => [newPaloma, ...prev]);
    setPalomaMessage('');
    setIsSendingPaloma(false);
    setShowEnviarPalomaModal(false);
    setShowPalomasHistory(true);

    setPalomaNotification('🕊️ ¡Paloma enviada al vuelo con éxito! Tu mensaje ya va en camino y ha sido guardado en el historial.');
    setTimeout(() => setPalomaNotification(''), 5500);
  };

  const handleRecibirPaloma = async () => {
    setIsReceivingPaloma(true);
    setPalomaNotification('🕊️ Buscando en el cielo... la paloma está llegando...');

    let foundNew = false;
    let latestLetter = null;

    try {
      const { data, error } = await supabase
        .from('gina_palomas')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        setPalomasList(prev => {
          const prevIds = new Set(prev.map(p => p.id));
          const newOnes = data.filter(d => !prevIds.has(d.id));
          if (newOnes.length > 0) {
            foundNew = true;
            latestLetter = newOnes[0];
          }
          const map = new Map();
          data.forEach(item => map.set(item.id, item));
          prev.forEach(item => {
            if (!map.has(item.id)) map.set(item.id, item);
          });
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
          );
        });
      }
    } catch (e) {
      console.log('Error receiving palomas from Supabase:', e);
    }

    setTimeout(() => {
      setIsReceivingPaloma(false);
      if (foundNew && latestLetter) {
        setLatestReceivedPaloma(latestLetter);
        setShowRecibirPalomaModal(true);
        setPalomaNotification(`🕊️ ¡Ha llegado una nueva paloma de ${latestLetter.sender}!`);
      } else if (palomasList.length > 0) {
        setLatestReceivedPaloma(palomasList[0]);
        setShowRecibirPalomaModal(true);
        setPalomaNotification('🕊️ ¡Paloma recibida! Mostrando la carta más reciente de tu historial.');
      } else {
        setPalomaNotification('🕊️ La paloma no trajo nuevas cartas por ahora. ¡Envía una primero!');
      }
      setTimeout(() => setPalomaNotification(''), 5500);
    }, 1100);
  };

  const handleDeletePaloma = async (palomaId, e) => {
    e?.stopPropagation();
    if (window.confirm('¿Deseas eliminar esta carta del historial?')) {
      setPalomasList(prev => prev.filter(p => p.id !== palomaId));
      try {
        await supabase.from('gina_palomas').delete().eq('id', palomaId);
      } catch (err) {
        console.log('Error deleting from Supabase:', err);
      }
    }
  };

  useEffect(() => {
    setVisibleCount(150);
  }, [searchQuery, selectedSender, startDate, endDate, sortOrder, selectedChat]);

  const loadDefaultChatFile = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/default_chat.txt?t=' + Date.now(), { cache: 'no-store' });
      if (res.ok) {
        const text = await res.text();
        const parsed = parseWhatsAppTxt(text);
        if (parsed.length > 0) {
          setSelectedChat({
            id: 'default-chat-gina',
            title: 'WhatsApp Chat - Gina Amatxu (2)',
            total_messages: parsed.length
          });
          setMessages(parsed);
        }
      }
    } catch (e) {
      console.warn('No se pudo cargar /default_chat.txt:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSavedChats = async () => {
    setIsLoading(true);
    let loadedFromSupabase = false;
    try {
      const { data, error } = await supabase
        .from('gina_whatsapp_chats')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        setChatsList(data);
        if (!selectedChat && !rawParsedData) {
          await loadChatMessages(data[0]);
        }
        loadedFromSupabase = true;
      }
    } catch (err) {
      console.error('Error cargando chats desde Supabase:', err);
    }

    if (!loadedFromSupabase && (!messages || messages.length === 0)) {
      await loadDefaultChatFile();
    }
    setIsLoading(false);
  };

  const loadChatMessages = async (chat) => {
    setSelectedChat(chat);
    setRawParsedData(null);
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('gina_whatsapp_messages')
        .select('*')
        .eq('chat_id', chat.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error cargando mensajes:', error);
      } else if (data) {
        const formatted = data.map(m => ({
          id: m.id,
          timestamp: m.timestamp,
          dateIso: m.date_iso,
          sender: m.sender,
          message: m.message,
          isSystem: m.is_system
        }));
        setMessages(formatted);
      }
    } catch (err) {
      console.error('Unexpected error loading messages:', err);
    }
    setIsLoading(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setCurrentFileName(file.name);
    const titleWithoutExt = file.name.replace(/\.txt$/i, '').replace(/^WhatsApp Chat - /i, '');
    setUploadTitle(titleWithoutExt || 'Chat de WhatsApp');

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target.result;
      const parsed = parseWhatsAppTxt(content);
      if (parsed.length === 0) {
        alert('No se pudieron encontrar mensajes válidos en este archivo .txt. Asegúrate de exportarlo directamente desde WhatsApp.');
        return;
      }
      setRawParsedData({
        fileName: file.name,
        messages: parsed
      });
      setSelectedChat(null);
      setMessages(parsed);
    };
    reader.readAsText(file);
  };

  const handleSaveToSupabase = async () => {
    if (!rawParsedData || !rawParsedData.messages.length) return;

    setIsSaving(true);
    try {
      // 1. Create chat header
      const { data: chatData, error: chatError } = await supabase
        .from('gina_whatsapp_chats')
        .insert([{
          title: uploadTitle || 'Chat de WhatsApp',
          filename: rawParsedData.fileName,
          total_messages: rawParsedData.messages.length
        }])
        .select()
        .single();

      if (chatError) {
        alert('Error al guardar en Supabase. Asegúrate de ejecutar el script supabase-gina-whatsapp-setup.sql: ' + chatError.message);
        setIsSaving(false);
        return;
      }

      // 2. Insert messages in chunks of 200
      const chunkSize = 200;
      const total = rawParsedData.messages.length;
      for (let i = 0; i < total; i += chunkSize) {
        const chunk = rawParsedData.messages.slice(i, i + chunkSize).map(m => ({
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
          console.error('Error insertando lote de mensajes:', msgError);
        }
      }

      alert('¡Chat guardado con éxito en Supabase!');
      setRawParsedData(null);
      await fetchSavedChats();
      await loadChatMessages(chatData);
    } catch (err) {
      alert('Error inesperado al guardar: ' + err.message);
    }
    setIsSaving(false);
  };

  const handleDeleteChat = async (chatId, e) => {
    e.stopPropagation();
    if (window.confirm('¿Estás segura de eliminar esta copia del chat?')) {
      const { error } = await supabase
        .from('gina_whatsapp_chats')
        .delete()
        .eq('id', chatId);

      if (error) {
        alert('Error al eliminar: ' + error.message);
      } else {
        if (selectedChat?.id === chatId) {
          setSelectedChat(null);
          setMessages([]);
        }
        fetchSavedChats();
      }
    }
  };

  // Get unique senders for filter
  const uniqueSenders = useMemo(() => {
    const set = new Set();
    messages.forEach(m => {
      if (m.sender && !m.isSystem) set.add(m.sender);
    });
    return Array.from(set);
  }, [messages]);

  // Main filtered message list
  const filteredMessages = useMemo(() => {
    return messages.filter(m => {
      // Search text filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const textMatch = m.message.toLowerCase().includes(q);
        const senderMatch = m.sender.toLowerCase().includes(q);
        if (!textMatch && !senderMatch) return false;
      }

      // Sender filter
      if (selectedSender !== 'all' && m.sender !== selectedSender) {
        return false;
      }

      // Date filters
      if (startDate && m.dateIso && m.dateIso < startDate) return false;
      if (endDate && m.dateIso && m.dateIso > endDate) return false;

      return true;
    });
  }, [messages, searchQuery, selectedSender, startDate, endDate]);

  // Sort displayed messages based on sortOrder (default: 'desc' = newest first at top)
  const displayedMessages = useMemo(() => {
    if (sortOrder === 'desc') {
      return [...filteredMessages].reverse();
    }
    return filteredMessages;
  }, [filteredMessages, sortOrder]);

  const visibleMessages = useMemo(() => {
    return displayedMessages.slice(0, visibleCount);
  }, [displayedMessages, visibleCount]);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const highlightText = (text, highlight) => {
    if (!highlight.trim()) return text;
    const parts = text.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, idx) =>
      part.toLowerCase() === highlight.toLowerCase() ? (
        <mark key={idx} className="bg-amber-300 text-gray-900 rounded px-0.5 font-bold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Determine main sender (usually Gina or first person)
  const primarySender = useMemo(() => {
    if (uniqueSenders.length === 0) return '';
    const ginaMatch = uniqueSenders.find(s => s.toLowerCase().includes('gina'));
    return ginaMatch || uniqueSenders[uniqueSenders.length - 1];
  }, [uniqueSenders]);

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-12">
      {/* Top Banner with Custom Photo */}
      <div className="relative rounded-3xl overflow-hidden shadow-xl border border-amber-500/20 text-white min-h-[250px] sm:min-h-[270px] flex flex-col justify-between group transition-all">
        {/* Background Image with warm tones */}
        <img
          src={bannerImg}
          alt="Banner de Recuerdos"
          className="absolute inset-0 w-full h-full object-cover object-[center_35%] transform group-hover:scale-105 transition-transform duration-700 pointer-events-none select-none"
        />

        {/* Ambient Dark Gradient Overlays for contrast and readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/35 backdrop-blur-[0.5px]"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent"></div>

        {/* Floating Header Controls */}
        <div className="relative z-10 p-3.5 sm:p-4 pb-0 flex justify-between items-center gap-2">
          <span className="bg-black/40 text-amber-200 border border-amber-400/30 text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-md flex items-center gap-1.5 shadow-sm">
            <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500 animate-pulse" />
            <span>Rincón Secreto · Recuerdos</span>
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowImageModal(true)}
              className="p-2 bg-black/40 hover:bg-black/60 text-amber-200 hover:text-white rounded-xl backdrop-blur-md border border-white/20 transition-all text-xs font-semibold flex items-center gap-1 shadow-sm active:scale-95"
              title="Ver imagen completa y notas"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ver foto</span>
            </button>

            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-2 bg-black/40 hover:bg-black/60 text-white rounded-xl backdrop-blur-md border border-white/20 transition-all text-xs font-semibold flex items-center gap-1 shadow-sm active:scale-95"
                title="Volver al inicio"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="p-2 bg-black/40 hover:bg-black/60 text-white rounded-xl backdrop-blur-md border border-white/20 transition-all text-xs font-semibold flex items-center gap-1 shadow-sm active:scale-95"
              title="¿Cómo exportar el chat?"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ayuda</span>
            </button>
          </div>
        </div>

        {/* Bottom Banner Content & Sentimental Text */}
        <div className="relative z-10 p-3.5 sm:p-4.5 pt-6">
          <div className="bg-black/40 backdrop-blur-md p-3 sm:p-3.5 rounded-2xl border border-white/15 shadow-md">
            <p className="text-xs sm:text-[13px] text-amber-100 italic leading-relaxed font-medium">
              “Como sé que no puedes tener nuestro chat, acá te dejo esto para que suspires como yo lo hago por cada vez que leo nuestras líneas, escucho nuestros audios o sueño viendo nuestras fotos. ❤️”
            </p>
            <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-amber-200/90 font-serif">
              <span className="truncate pr-2">A donde sea... siempre contigo ♡</span>
              <button 
                type="button"
                onClick={() => setShowImageModal(true)}
                className="text-amber-300 hover:text-white underline underline-offset-2 font-sans font-semibold shrink-0"
              >
                Toca para ampliar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PALOMA MENSAJERA INTERACTIVE CARD */}
      <div className="bg-gradient-to-br from-amber-50/95 via-orange-50/50 to-rose-50/70 p-4 sm:p-5 rounded-3xl shadow-sm border border-amber-200/90 space-y-3.5 relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-lg shadow-inner">
              🕊️
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-gray-900 flex items-center gap-1.5">
                Paloma Mensajera
                <span className="text-[10px] font-bold bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300/60">
                  {palomasList.length} {palomasList.length === 1 ? 'carta' : 'cartas'}
                </span>
              </h3>
              <p className="text-[11px] text-gray-600">
                Envía o recibe mensajes al vuelo · Historial permanente ♡
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowPalomasHistory(!showPalomasHistory)}
            className="text-xs font-bold text-amber-900 hover:text-amber-950 bg-amber-100 hover:bg-amber-200/80 px-3 py-1.5 rounded-xl border border-amber-300/80 transition-all flex items-center gap-1 shadow-2xs active:scale-95"
          >
            <Feather className="w-3.5 h-3.5 text-amber-700" />
            <span>{showPalomasHistory ? 'Ocultar' : 'Historial'}</span>
            {showPalomasHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Action Buttons: ENVIAR PALOMA & RECIBIR PALOMA */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-1">
          {/* ENVIAR PALOMA */}
          <button
            type="button"
            onClick={() => setShowEnviarPalomaModal(true)}
            className="group relative overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:via-orange-600 hover:to-rose-600 text-white p-3 sm:p-3.5 rounded-2xl font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-center"
          >
            <div className="w-7 h-7 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-sm shadow-inner group-hover:scale-110 transition-transform">
              🕊️
            </div>
            <div className="text-left">
              <span className="block leading-tight font-extrabold tracking-wide">Enviar paloma</span>
              <span className="text-[10px] text-amber-100/90 font-normal">Mandar una carta</span>
            </div>
          </button>

          {/* RECIBIR PALOMA */}
          <button
            type="button"
            onClick={handleRecibirPaloma}
            disabled={isReceivingPaloma}
            className="group relative overflow-hidden bg-gradient-to-r from-sky-600 via-teal-600 to-emerald-600 hover:from-sky-700 hover:via-teal-700 hover:to-emerald-700 text-white p-3 sm:p-3.5 rounded-2xl font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-center disabled:opacity-75"
          >
            <div className={`w-7 h-7 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-sm shadow-inner group-hover:scale-110 transition-transform ${isReceivingPaloma ? 'animate-bounce' : ''}`}>
              📬
            </div>
            <div className="text-left">
              <span className="block leading-tight font-extrabold tracking-wide">
                {isReceivingPaloma ? 'Buscando...' : 'Recibir paloma'}
              </span>
              <span className="text-[10px] text-sky-100/90 font-normal">Revisar cartas</span>
            </div>
          </button>
        </div>

        {/* Floating / Inline notification message */}
        {palomaNotification && (
          <div className="bg-amber-100/90 border border-amber-300 text-amber-900 text-xs p-2.5 rounded-xl flex items-center gap-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 animate-spin" />
            <span className="font-semibold">{palomaNotification}</span>
          </div>
        )}

        {/* HISTORIAL DE MENSAJES DE PALOMAS (EXPANDIBLE) */}
        {showPalomasHistory && (
          <div className="pt-2 border-t border-amber-200/80 space-y-2.5 animate-in fade-in">
            <div className="flex justify-between items-center text-xs text-gray-600">
              <span className="font-bold flex items-center gap-1.5 text-gray-800">
                <Mail className="w-3.5 h-3.5 text-amber-600" />
                Historial de Cartas ({palomasList.length})
              </span>
              <span className="text-[10px] text-gray-500 font-medium">Permanente y seguro</span>
            </div>

            {palomasList.length === 0 ? (
              <div className="text-center py-6 bg-white/70 rounded-2xl border border-dashed border-amber-200 text-xs text-gray-500">
                <p className="font-medium">Aún no has enviado ninguna paloma mensajera.</p>
                <p className="text-[11px] text-amber-700 mt-1">¡Toca "Enviar paloma" para mandar la primera carta!</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {palomasList.map((p) => {
                  const isJuanSe = p.sender.toLowerCase().includes('juan') || p.sender.toLowerCase().includes('sebasti');
                  const dateFormatted = new Date(p.created_at).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-2xl border text-xs space-y-2 transition-all shadow-2xs ${
                        isJuanSe
                          ? 'bg-amber-50/95 border-amber-200/90 text-amber-950'
                          : 'bg-rose-50/95 border-rose-200/90 text-rose-950'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold flex items-center gap-1 text-[11px]">
                          {isJuanSe ? '👦' : '⭐'} <span className="font-extrabold">{p.sender}</span>
                          <span className="text-gray-400 font-normal">→</span>
                          <span>{p.recipient}</span>
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-gray-500">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span>{dateFormatted}</span>
                        </div>
                      </div>

                      <p className="font-serif italic leading-relaxed text-gray-800 text-[12px] bg-white/80 p-2.5 rounded-xl border border-black/5 whitespace-pre-wrap">
                        “{p.message}”
                      </p>

                      <div className="flex justify-between items-center text-[10px] text-gray-400 pt-0.5">
                        <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                          🕊️ Entregada al corazón
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(p.message);
                              setPalomaNotification('Carta copiada al portapapeles 📋');
                              setTimeout(() => setPalomaNotification(''), 3000);
                            }}
                            className="hover:text-gray-700 flex items-center gap-0.5 font-medium"
                            title="Copiar texto"
                          >
                            <Copy className="w-3 h-3" /> Copiar
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeletePaloma(p.id, e)}
                            className="text-rose-400 hover:text-rose-600 p-0.5"
                            title="Eliminar carta"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Bar: Upload or Pick Saved Chat */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
          <label className="flex-1 cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-2xl p-3 text-center transition-all font-bold text-xs flex items-center justify-center gap-2 shadow-2xs">
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Subir/Importar Chat (.txt)</span>
            <input
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {chatsList.length > 0 && (
            <button
              onClick={fetchSavedChats}
              className="p-3 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-2xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
              title="Actualizar chats guardados"
            >
              <RefreshCw className={`w-4 h-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="sm:hidden">Actualizar</span>
            </button>
          )}
        </div>

        {/* Unsaved Raw Upload Notice */}
        {rawParsedData && (
          <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl text-xs space-y-2.5">
            <div className="flex justify-between items-center text-amber-900 font-bold">
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-600" />
                Vista Previa: {currentFileName} ({rawParsedData.messages.length} msgs)
              </span>
              <button
                onClick={() => { setRawParsedData(null); setMessages([]); }}
                className="text-amber-700 hover:text-amber-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Nombre para identificar este chat (ej. Chat Cliente X)"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                className="flex-1 p-2 bg-white border border-amber-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              />
              <button
                onClick={handleSaveToSupabase}
                disabled={isSaving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shrink-0 shadow-sm transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <CloudUpload className="w-4 h-4" />
                    Guardar en Nube
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Saved Chats Drawer/Selector */}
        {chatsList.length > 0 && !rawParsedData && (
          <div className="pt-1 border-t border-gray-100">
            <span className="text-[11px] font-bold text-gray-500 block mb-1.5 flex items-center gap-1">
              <FolderOpen className="w-3.5 h-3.5 text-emerald-600" />
              Chats Guardados en Supabase:
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
              {chatsList.map(c => (
                <div
                  key={c.id}
                  onClick={() => loadChatMessages(c)}
                  className={`cursor-pointer px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 border ${
                    selectedChat?.id === c.id
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-emerald-50 hover:border-emerald-300'
                  }`}
                >
                  <span className="truncate max-w-[150px]">{c.title}</span>
                  <span className="text-[10px] opacity-75">({c.total_messages})</span>
                  <button
                    onClick={(e) => handleDeleteChat(c.id, e)}
                    className="hover:text-red-300 transition-colors p-0.5 rounded"
                    title="Eliminar chat"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Chat Interface */}
      {messages.length > 0 ? (
        <div className="bg-white rounded-3xl shadow-md border border-gray-200 overflow-hidden flex flex-col h-[600px]">
          {/* WhatsApp Header Bar */}
          <div className="bg-emerald-800 text-white p-3.5 px-4 flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-base shadow-inner">
                💬
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight truncate max-w-[200px]">
                  {selectedChat?.title || uploadTitle || 'Chat Exportado'}
                </h3>
                <span className="text-[11px] text-emerald-200 font-medium">
                  {filteredMessages.length} de {messages.length} mensajes
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {rawParsedData && (
                <span className="bg-amber-400 text-gray-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Sin Guardar
                </span>
              )}
            </div>
          </div>

          {/* Search & Filter Options Bar */}
          <div className="bg-gray-100 p-3 border-b border-gray-200 space-y-2 shrink-0">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar palabra, frase o dato en el chat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 p-2 bg-white border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sub-Filters: Sender & Date Range */}
            <div className="flex flex-wrap gap-2 text-xs">
              {/* Emisor Filter */}
              {uniqueSenders.length > 1 && (
                <select
                  value={selectedSender}
                  onChange={(e) => setSelectedSender(e.target.value)}
                  className="p-1.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold outline-none"
                >
                  <option value="all">Todos los emisores</option>
                  {uniqueSenders.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}

              {/* Date pickers */}
              <div className="flex items-center gap-1 bg-white border border-gray-300 px-2 py-1 rounded-xl">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-[11px] font-medium outline-none bg-transparent"
                  title="Desde"
                />
                <span className="text-gray-400 text-[10px]">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-[11px] font-medium outline-none bg-transparent"
                  title="Hasta"
                />
                {(startDate || endDate) && (
                  <button
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Sort Order Toggle Button */}
              <button
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="p-1.5 bg-white border border-gray-300 rounded-xl text-[11px] font-semibold outline-none flex items-center gap-1 hover:bg-emerald-50 hover:border-emerald-300 text-gray-700 transition-colors shadow-2xs"
                title="Cambiar orden de mensajes"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-600" />
                <span>{sortOrder === 'desc' ? 'Más recientes primero' : 'Más antiguos primero'}</span>
              </button>
            </div>
          </div>

          {/* Messages Scroll Area (Styled like WhatsApp wallpaper) */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e5ddd5] bg-opacity-70 font-sans"
            style={{
              backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
              backgroundSize: '16px 16px'
            }}
          >
            {isLoading ? (
              <div className="bg-white/90 p-6 rounded-2xl text-center text-xs text-gray-600 max-w-xs mx-auto my-10 border border-gray-200 shadow-xs flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />
                <span>Cargando historial del chat...</span>
              </div>
            ) : displayedMessages.length === 0 ? (
              <div className="bg-white/90 p-4 rounded-2xl text-center text-xs text-gray-500 max-w-xs mx-auto my-10 border border-gray-200 shadow-xs">
                No se encontraron mensajes con los filtros seleccionados.
              </div>
            ) : (
              <>
                {visibleMessages.map((msg, idx) => {
                const isPrimary = msg.sender === primarySender;
                const isSystem = msg.isSystem;

                if (isSystem) {
                  return (
                    <div key={msg.id || idx} className="flex justify-center my-2">
                      <div className="bg-amber-100/90 border border-amber-200 text-amber-900 text-[11px] px-3 py-1 rounded-lg text-center max-w-xs shadow-2xs font-medium">
                        {msg.message}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id || idx}
                    className={`flex flex-col group ${isPrimary ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`relative max-w-[85%] rounded-2xl p-3 text-xs shadow-xs space-y-1 transition-all ${
                        isPrimary
                          ? 'bg-[#dcf8c6] text-gray-900 rounded-tr-xs border border-emerald-200/50'
                          : 'bg-white text-gray-900 rounded-tl-xs border border-gray-200'
                      }`}
                    >
                      {/* Sender Header */}
                      {!isPrimary && (
                        <span className="text-[11px] font-bold text-teal-700 block">
                          {msg.sender}
                        </span>
                      )}

                      {/* Message Content */}
                      <p className="whitespace-pre-wrap leading-relaxed text-gray-800 break-words font-normal text-xs">
                        {highlightText(msg.message, searchQuery)}
                      </p>

                      {/* Footer: Timestamp & Copy Button */}
                      <div className="flex items-center justify-end gap-1.5 pt-1 text-[10px] text-gray-400 font-mono">
                        <span>{msg.timestamp}</span>
                        {isPrimary && (
                          <CheckCheck className="w-3.5 h-3.5 text-sky-500" />
                        )}
                        <button
                          onClick={() => copyToClipboard(msg.message, msg.id || idx)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-gray-700 rounded ml-1"
                          title="Copiar mensaje"
                        >
                          {copiedId === (msg.id || idx) ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

                {visibleCount < displayedMessages.length && (
                  <div className="flex justify-center pt-3 pb-6">
                    <button
                      type="button"
                      onClick={() => setVisibleCount(prev => prev + 250)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Cargar más mensajes (mostrando {visibleMessages.length} de {displayedMessages.length})</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-3xl p-8 text-center border border-gray-200 space-y-4 shadow-xs">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <MessageSquare className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">No hay ningún chat cargado</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
              Sube el archivo <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-emerald-700">.txt</code> exportado de tu WhatsApp o selecciona un chat guardado previamente.
            </p>
          </div>
          <button
            onClick={() => setShowHelpModal(true)}
            className="text-xs text-emerald-700 font-bold hover:underline flex items-center justify-center gap-1 mx-auto"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            ¿Cómo exportar tu chat desde el móvil?
          </button>
        </div>
      )}

      {/* HELP MODAL: How to export WhatsApp Chat */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-600" />
                ¿Cómo exportar tu chat de WhatsApp?
              </h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-gray-700">
              <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                <h4 className="font-bold text-emerald-900 mb-1">En Android:</h4>
                <ol className="list-decimal list-inside space-y-1 text-emerald-800">
                  <li>Abre WhatsApp y entra al chat que deseas guardar.</li>
                  <li>Toca los <strong>3 puntos (⋮)</strong> en la esquina superior derecha.</li>
                  <li>Selecciona <strong>Más</strong> &gt; <strong>Exportar chat</strong>.</li>
                  <li>Elige <strong>Sin archivos de media</strong> (para que sea solo texto súper liviano).</li>
                  <li>Envía el archivo <code className="font-mono bg-emerald-100 px-1 rounded">.txt</code> a tu correo o guardalo en Drive/PC para subirlo a la app.</li>
                </ol>
              </div>

              <div className="bg-sky-50 p-3 rounded-2xl border border-sky-100">
                <h4 className="font-bold text-sky-900 mb-1">En iPhone (iOS):</h4>
                <ol className="list-decimal list-inside space-y-1 text-sky-800">
                  <li>Abre WhatsApp y entra al chat.</li>
                  <li>Toca el <strong>nombre del contacto o grupo</strong> en la parte superior.</li>
                  <li>Desplázate hacia abajo y toca <strong>Exportar chat</strong>.</li>
                  <li>Selecciona <strong>Sin archivos de media</strong>.</li>
                  <li>Guarda el archivo en Archivos de iPhone o envíalo por email/AirDrop.</li>
                </ol>
              </div>

              <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100 flex items-start gap-2 text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Una vez subido el chat:</strong> Puedes hacer clic en <strong>"Guardar en Nube"</strong> y el chat quedará disponible permanentemente en la app sin necesidad de volver a subir el archivo.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold p-3 rounded-xl transition-all"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* FULL PHOTO LIGHTBOX MODAL */}
      {showImageModal && (
        <div
          className="fixed inset-0 bg-black/92 backdrop-blur-md z-50 flex flex-col items-center justify-center p-3 sm:p-6 animate-in fade-in select-none"
          onClick={() => setShowImageModal(false)}
        >
          <div
            className="relative max-w-xl w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div className="w-full flex justify-between items-center mb-2.5 px-2 text-white">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 fill-rose-500 text-rose-500 animate-pulse" />
                <span className="text-xs sm:text-sm font-semibold tracking-wide text-amber-200">
                  Algunos caminos también se viven en el corazón ♡
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowImageModal(false)}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all active:scale-90"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Photo Card */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-black/40 w-full flex items-center justify-center">
              <img
                src={bannerImg}
                alt="Recuerdo Especial"
                className="w-full max-h-[75vh] object-contain rounded-2xl"
              />
            </div>

            {/* Sentimental Footer */}
            <div className="text-center mt-3 space-y-1">
              <p className="text-xs sm:text-sm text-amber-100 font-serif italic">
                “Hay amores que no se olvidan... solo se guardan en otra forma. ♡”
              </p>
              <p className="text-[11px] text-amber-200/70 font-sans">
                A donde sea... siempre contigo ♡
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ENVIAR PALOMA */}
      {showEnviarPalomaModal && (
        <div
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in"
          onClick={() => setShowEnviarPalomaModal(false)}
        >
          <div
            className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-amber-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-xl shadow-inner">
                  🕊️
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-1.5">
                    Enviar Paloma Mensajera
                  </h3>
                  <p className="text-[11px] text-gray-500">Manda una carta que quedará guardada en el historial ♡</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEnviarPalomaModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendPaloma} className="space-y-4">
              {/* Who is sending */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  ¿Quién envía la carta?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setPalomaSender('Juan Sebastián'); setPalomaRecipient('Gina'); }}
                    className={`p-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      palomaSender === 'Juan Sebastián'
                        ? 'bg-amber-50 border-amber-400 text-amber-950 shadow-xs'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-base">👦</span>
                    <span>Juan Sebastián</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPalomaSender('Gina'); setPalomaRecipient('Juan Sebastián'); }}
                    className={`p-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      palomaSender === 'Gina'
                        ? 'bg-rose-50 border-rose-400 text-rose-950 shadow-xs'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-base">⭐</span>
                    <span>Gina</span>
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-gray-500">
                  <span>Destinatario: <strong className="text-amber-800">{palomaRecipient}</strong></span>
                  <span className="text-[10px] text-emerald-600 font-medium">🕊️ Entrega directa</span>
                </div>
              </div>

              {/* Message text area */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Mensaje / Carta:
                </label>
                <textarea
                  rows="4"
                  required
                  value={palomaMessage}
                  onChange={(e) => setPalomaMessage(e.target.value)}
                  placeholder="Escribe tus palabras aquí... La paloma volará al atardecer llevando este mensaje directo a su corazón ♡"
                  className="w-full p-3.5 bg-amber-50/40 border border-amber-200/90 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none text-xs sm:text-sm font-serif resize-none leading-relaxed"
                ></textarea>

                {/* Quick Mood Emojis */}
                <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1 text-sm">
                  <span className="text-[10px] text-gray-400 shrink-0 font-sans">Añadir:</span>
                  {['❤️', '💌', '🕊️', '🌅', '✨', '🌻', '🏍️', '💫', '♡'].map((emo) => (
                    <button
                      type="button"
                      key={emo}
                      onClick={() => setPalomaMessage(prev => prev + ' ' + emo)}
                      className="p-1 hover:bg-amber-100 rounded text-xs transition-colors shrink-0"
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSendingPaloma}
                className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-extrabold p-3.5 rounded-2xl shadow-md transition-all active:scale-[0.98] disabled:opacity-75 flex items-center justify-center gap-2 text-xs sm:text-sm"
              >
                {isSendingPaloma ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>🕊️ Soltar Paloma Mensajera</span>
                    <Send className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECIBIR PALOMA (CARTA EN PANTALLA) */}
      {showRecibirPalomaModal && latestReceivedPaloma && (
        <div
          className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in"
          onClick={() => setShowRecibirPalomaModal(false)}
        >
          <div
            className="bg-gradient-to-br from-amber-50 via-white to-rose-50 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border-2 border-amber-300 space-y-4 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header stamp */}
            <div className="flex justify-between items-start border-b border-amber-200/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xl shadow-inner animate-pulse">
                  🕊️
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                    Carta de la Paloma Mensajera
                  </span>
                  <h3 className="text-sm sm:text-base font-extrabold text-gray-900 mt-0.5">
                    De: {latestReceivedPaloma.sender}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRecibirPalomaModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-amber-100/50 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Letter Body */}
            <div className="bg-white/80 p-4 sm:p-5 rounded-2xl border border-amber-200 shadow-inner space-y-2">
              <div className="flex justify-between items-center text-[11px] text-gray-500 pb-1 border-b border-gray-100">
                <span>Para: <strong>{latestReceivedPaloma.recipient}</strong></span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-600" />
                  {new Date(latestReceivedPaloma.created_at).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>

              <p className="font-serif italic text-gray-800 text-sm sm:text-base leading-relaxed pt-2 whitespace-pre-wrap">
                “{latestReceivedPaloma.message}”
              </p>
            </div>

            {/* Footer buttons */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowRecibirPalomaModal(false);
                  setShowPalomasHistory(true);
                }}
                className="flex-1 p-3 rounded-xl border border-amber-300 bg-amber-100/60 hover:bg-amber-100 text-amber-900 text-xs font-bold transition-all text-center"
              >
                Ver historial ({palomasList.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRecibirPalomaModal(false);
                  setPalomaSender(latestReceivedPaloma.recipient);
                  setPalomaRecipient(latestReceivedPaloma.sender);
                  setShowEnviarPalomaModal(true);
                }}
                className="flex-1 p-3 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white text-xs font-bold transition-all shadow-sm text-center flex items-center justify-center gap-1.5"
              >
                <span>Responder</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
