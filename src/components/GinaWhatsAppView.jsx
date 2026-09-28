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
  ArrowLeft
} from 'lucide-react';


/**
 * Parses raw WhatsApp .txt export content into structured message objects
 */
function parseWhatsAppTxt(txtContent) {
  const lines = txtContent.split(/\r?\n/);
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

  // UI State
  const [copiedId, setCopiedId] = useState(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [rawParsedData, setRawParsedData] = useState(null);
  const [currentFileName, setCurrentFileName] = useState('');

  const chatContainerRef = useRef(null);

  useEffect(() => {
    fetchSavedChats();
  }, []);

  const loadDefaultChatFile = async () => {
    try {
      const res = await fetch('/default_chat.txt');
      if (res.ok) {
        const text = await res.text();
        const parsed = parseWhatsAppTxt(text);
        if (parsed.length > 0) {
          setSelectedChat({
            id: 'default-chat-gina',
            title: 'WhatsApp Chat - Gina Amatxu',
            total_messages: parsed.length
          });
          setMessages(parsed);
        }
      }
    } catch (e) {
      console.warn('No se pudo cargar /default_chat.txt:', e);
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
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-700 to-teal-800 rounded-3xl p-5 text-white shadow-md relative overflow-hidden">
        <div className="flex justify-between items-start">
          <div>
            <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm flex items-center gap-1.5 w-max mb-2">
              <MessageSquare className="w-3.5 h-3.5 fill-emerald-300 text-emerald-300" />
              Copia de WhatsApp de Gina
            </span>
            <h2 className="text-xl font-bold">Consulta de Chat de WhatsApp</h2>
            <p className="text-xs text-emerald-100 mt-1">
              Consulta conversaciones, fechas y datos de WhatsApp sin necesidad de tener el móvil encendido.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-sm transition-all text-xs font-semibold flex items-center gap-1"
                title="Volver al inicio"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver</span>
              </button>
            )}
            <button
              onClick={() => setShowHelpModal(true)}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-sm transition-all text-xs font-semibold flex items-center gap-1"
              title="¿Cómo exportar el chat?"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Ayuda</span>
            </button>
          </div>
        </div>
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
            {filteredMessages.length === 0 ? (
              <div className="bg-white/90 p-4 rounded-2xl text-center text-xs text-gray-500 max-w-xs mx-auto my-10 border border-gray-200 shadow-xs">
                No se encontraron mensajes con los filtros seleccionados.
              </div>
            ) : (
              filteredMessages.map((msg, idx) => {
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
              })
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
    </div>
  );
}
