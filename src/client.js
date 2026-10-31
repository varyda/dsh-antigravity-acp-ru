/**
 * Browser settings section for the Antigravity ACP bundle.
 * Loaded by DSH ModuleLoader; React is provided by the shell (do not bundle Node).
 *
 * Transport notes (verified against the installed shell contract, not guessed):
 * - `remote.settings.describe()` returns `{ writable, namespaces: [{ ns, value, revision }] }`.
 * - `remote.settings.mutate(entryId, ops, revision)` writes; ops are `{ op: 'set', path, value }`.
 * - `remote.llm.listProviders()` exists. There is **no** `remote.llm.listModels` in the
 *   shell, so the model catalogue cannot be fetched from here; it is surfaced through
 *   the host adapter (see src/adapter/antigravity-adapter.ts) and the plugin's own
 *   settings form instead.
 *
 * Inject contract (verified against the installed shell, 2026-10-16): each
 * `remote.<namespace>` face is its own injectable service. Reading it without a
 * matching entry in `inject` throws `cannot get property "remote.<ns>" without
 * inject` (Cordis ReflectService), which crashes this card inside the
 * `settings.section` slot and blanks the settings page. The shell's own client
 * plugins declare it the same way (`inject = ["remote", "remote.settings"]`).
 */
window.__ModuleLoader__.load({
  id: 'dsh-bundle-antigravity-host',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const PROVIDER = 'antigravity-acp'
    /** Settings namespace projected from Config's volatile fields in src/settings.ts. */
    const ENTRY_ID = 'llm-antigravity-acp'
    /** Live fields owned by this card; ordinary fields stay in the host config editor. */
    const FIELDS = [
      { key: 'autoWarmup', group: 'general', checkbox: true, defaultChecked: true, label: 'Прогрев при запуске', hint: 'Заранее запускает и удерживает соединение, не отправляя сообщений модели. Применяется при следующем включении плагина; сейчас можно нажать «Прогреть сразу».' },
      { key: 'reuseSessions', group: 'general', checkbox: true, defaultChecked: true, label: 'Переиспользовать ACP-сессию (досылка только нового)', hint: 'После сверки истории с фактическим выводом отправляются только новые сообщения; изменившийся контекст отправляется, при расхождении сессия пересоздаётся.' },
      { key: 'proxyUrl', group: 'network', label: 'Исходящий прокси', placeholder: 'http://127.0.0.1:7890', hint: 'Приоритет у этого значения; если пусто — берётся прокси из окружения хоста, и только при его отсутствии соединение прямое. Поддерживаются HTTP, HTTPS и SOCKS5.' },
      { key: 'proxyBypass', group: 'network', label: 'Исключения прокси', placeholder: '*.internal,example.internal', hint: 'Через запятую; поддерживаются домены и wildcard-суффиксы, CIDR — нет. localhost/127.0.0.1/::1 исключаются всегда (приватный MCP-мост работает через loopback).' },
      { key: 'agyCliPath', group: 'network', label: 'Путь к официальному CLI (необязательно)', placeholder: 'пусто — искать agy автоматически', hint: 'Используется для каталога моделей, квот тарифа и AI Credits. При нестандартной установке укажите полный путь к исполняемому файлу; вход в CLI и вход в ACP независимы.' },
      { key: 'resumeSessions', group: 'advanced', checkbox: true, label: 'Восстанавливать ACP-сессию после перезапуска', hint: 'Пытается загрузить локальную карту, при неудаче пересоздаёт; хранятся только ID и отпечатки. Требует включённого переиспользования сессий.' },
      { key: 'keepProcessAfterCancel', group: 'advanced', checkbox: true, label: 'Оставлять процесс после отмены', hint: 'Процесс сохраняется только после подтверждения остановки агентом; новые ходы ждут в очереди, при таймауте или сбое связи процесс освобождается.' },
      { key: 'cancelGraceMs', group: 'advanced', numeric: true, defaultValue: 30000, min: 0, max: 60000, label: 'Ожидание подтверждения отмены (мс)', hint: 'По умолчанию 30000; 0 — не ждать и сразу освобождать, неподтверждённое соединение не переиспользуется. Действует только при включённом «Оставлять процесс после отмены».' },
      { key: 'idleRecycleMs', group: 'advanced', numeric: true, defaultValue: 300000, min: 0, max: 3600000, label: 'Освобождение простаивающего процесса (мс)', hint: 'По умолчанию 300000 (5 минут), 0 — выключено. Отсчёт идёт после чата, прогрева и обновления каталога; ожидание инструментов простоем не считается.' },
    ]

    /** 逐模型设置：键是 DSH 选择器里的模型 ID，值是开关、默认档位、显示名与官方 ID 映射。 */
    const OVERRIDES_KEY = 'modelOverrides'
    const OVERRIDES_LABEL = 'Настройки списка моделей'
    const EFFORT_OPTIONS = [
      { value: '', label: 'Как в официальном клиенте' },
      { value: 'low', label: 'низкий' },
      { value: 'medium', label: 'средний' },
      { value: 'high', label: 'высокий' },
    ]
    const EFFORT_IDS = new Set(EFFORT_OPTIONS.map((entry) => entry.value).filter(Boolean))
    const MODALITY_LABELS = { text: 'текст', image: 'изображение', audio: 'аудио', video: 'видео', file: 'файл' }

    /** 只保留有意义的字段：启用是默认值，空串等于未设置。 */
    function canonicalOverride(row) {
      const source = row && typeof row === 'object' ? row : {}
      const result = {}
      if (source.enabled === false) result.enabled = false
      if (EFFORT_IDS.has(source.effort)) result.effort = source.effort
      const name = typeof source.name === 'string' ? source.name.trim() : ''
      if (name) result.name = name
      const target = typeof source.target === 'string' ? source.target.trim() : ''
      if (target) result.target = target
      return result
    }
    /** 稳定序列化：键序不影响脏值判断。 */
    function canonicalOverrides(value) {
      const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
      const result = {}
      for (const key of Object.keys(source).sort()) {
        const row = canonicalOverride(source[key])
        if (Object.keys(row).length > 0) result[key] = row
      }
      return result
    }
    function sameOverrides(a, b) {
      return JSON.stringify(canonicalOverrides(a)) === JSON.stringify(canonicalOverrides(b))
    }
    function overrideFor(overrides, id) {
      const row = overrides && typeof overrides === 'object' ? overrides[id] : undefined
      return row && typeof row === 'object' ? row : {}
    }
    /** 目录条目 + 已配置但当前目录没有的 ID，都要能在此编辑。 */
    function modelRows(models, overrides) {
      const rows = models.map((model) => ({ id: model.id, name: model.name, inputModalities: model.inputModalities, inCatalog: true }))
      const known = new Set(rows.map((row) => row.id))
      for (const id of Object.keys(canonicalOverrides(overrides))) {
        if (!known.has(id)) rows.push({ id, name: id, inCatalog: false })
      }
      return rows
    }

    function unwrap(result) {
      if (result && typeof result === 'object' && 'ok' in result) {
        if (result.ok) return result.value
        throw new Error(result.error?.message || 'Неизвестная ошибка')
      }
      return result
    }

    const RUNTIME_PHASES = {
      idle: 'не запущено', binary: 'подготовка файла', credentials: 'подготовка учётных данных', spawn: 'запуск процесса',
      initialize: 'ожидание рукопожатия', authenticate: 'ожидание входа', ready: 'соединение готово', connection: 'подготовка соединения',
      session: 'создание сессии', model: 'выбор модели', prompt: 'ожидание первого блока', streaming: 'генерация ответа',
      'waiting-tools': 'ожидание результата инструмента DSH', continuing: 'ожидание ответа после инструмента', recycling: 'освобождение процесса',
      stopped: 'остановлено', error: 'ошибка соединения', disposed: 'плагин выгружен',
    }
    function runtimeBusy(runtime) {
      if (runtime?.queue && (runtime.queue.active > 0 || runtime.queue.parked > 0 || runtime.queue.waiting > 0)) return true
      return runtime && !['idle', 'ready', 'stopped', 'error', 'disposed'].includes(runtime.phase)
    }
    function duration(ms) {
      if (!Number.isFinite(ms)) return '—'
      if (ms < 1000) return Math.round(ms) + ' ms'
      if (ms < 60000) return (ms / 1000).toFixed(2) + ' s'
      return Math.floor(ms / 60000) + ' мин ' + Math.floor(ms % 60000 / 1000) + ' с'
    }
    /** 连接中且进程仍在启动时，给出阶段、已用时间与冷启动提示（官方进程冷启动可达 1 分钟）。 */
    function startupHint(account) {
      const runtime = account?.runtime
      if (account?.state !== 'connecting' || !runtime || !['binary', 'credentials', 'spawn', 'initialize', 'authenticate', 'session'].includes(runtime.phase)) return undefined
      const slow = ['spawn', 'initialize'].includes(runtime.phase) ? '; первый холодный старт официального процесса может занять около минуты' : ''
      return (RUNTIME_PHASES[runtime.phase] ?? runtime.phase) + '… прошло ' + duration(runtime.phaseElapsedMs) + slow
    }
    function connectionStatus(account, registered) {
      const runtime = account?.runtime
      const ready = runtime?.phase === 'ready'
      const busy = runtimeBusy(runtime) || ['connecting', 'cancelling'].includes(account?.state)
      const error = account?.state === 'error' || runtime?.phase === 'error' || registered === false
      const label = registered === false ? 'Provider не зарегистрирован'
        : error ? 'соединение требует проверки'
          : busy ? account?.state === 'cancelling' ? 'отмена подключения' : 'подготовка подключения'
            : ready ? account?.state === 'connected' ? 'аккаунт проверен' : 'ACP прогрет'
              : account?.state === 'cancelled' || runtime?.phase === 'stopped' ? 'соединение остановлено'
                : account?.state === 'connected' ? 'аккаунт проверен' : 'соединение не проверено'
      const description = account?.runtime?.phase === 'stopped'
        ? 'ACP-соединение остановлено, можно прогреть заново.'
        : account?.runtime?.phase === 'error'
          ? account.runtime.error ?? account?.message ?? 'Ошибка ACP-соединения, повторите попытку.'
          : registered === false ? 'Убедитесь, что плагин включён и загружены и Host, и Client.'
            : startupHint(account) ?? account?.message ?? 'После подключения можно проверить аккаунт и прочитать каталог моделей — сообщения в чат не отправляются.'
      return { label, description, ready, busy, error, color: error ? '#d97757' : ready ? '#25b879' : busy ? '#d99b28' : '#8b909a' }
    }
    function StatusDot({ color }) {
      return h('span', { 'aria-hidden': true, style: { width: '8px', height: '8px', flex: '0 0 auto', borderRadius: '50%', background: color, boxShadow: '0 0 0 4px rgba(128,128,128,.10)' } })
    }
    function StatusNotice({ status }) {
      if (!status) return null
      const error = status.kind === 'error'
      return h('p', { role: error ? 'alert' : 'status', style: { margin: 0, padding: '10px 12px', borderRadius: '10px', fontSize: '12px', lineHeight: 1.6, overflowWrap: 'anywhere', color: error ? '#b42318' : status.kind === 'busy' ? '#946200' : '#177c55', background: error ? 'rgba(217,119,87,.10)' : status.kind === 'busy' ? 'rgba(217,155,40,.10)' : 'rgba(37,184,121,.10)' } }, status.text)
    }
    function RuntimeDetails({ runtime }) {
      if (!runtime) return null
      const row = (label, value) => h('div', { key: label, style: { display: 'flex', justifyContent: 'space-between', gap: '16px' } },
        h('span', { style: { opacity: .65 } }, label), h('span', { style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' } }, value))
      const round = runtime.round
      const queue = runtime.queue
      return h('div', { 'aria-label': 'Жизненный цикл ACP и тайминги', style: { display: 'grid', gap: '8px', fontSize: '12px', lineHeight: 1.5 } },
        row('Текущее состояние', (RUNTIME_PHASES[runtime.phase] ?? runtime.phase) + ' · ' + duration(runtime.phaseElapsedMs)),
        queue ? row('Планирование сессий', 'активных ' + queue.active + ' · ждут инструмент ' + queue.parked + ' · в очереди ' + queue.waiting) : null,
        queue ? row('Параллельные соединения', queue.workers + ' / ' + queue.capacity) : null,
        runtime.processRunning ? row('Процесс работает', duration(runtime.uptimeMs)) : null,
        row('Статистика процесса', 'запусков ' + runtime.starts + ' · переиспользований ' + runtime.reuses + ' · освобождений ' + runtime.recycles),
        runtime.startup ? row('Длительность последнего запуска', duration(runtime.startup.elapsedMs)) : null,
        ...Object.entries(runtime.startup?.timings ?? {}).map(([name, ms]) => row(RUNTIME_PHASES[name] ?? name, duration(ms))),
        round ? row('Текущий / последний ход', round.model + ' · ' + duration(round.elapsedMs)) : null,
        ...Object.entries(round?.timings ?? {}).map(([name, ms]) => row(RUNTIME_PHASES[name] ?? name, duration(ms))),
        round?.firstChunkMs !== undefined ? row('prompt → первый блок', duration(round.firstChunkMs)) : null,
        round?.firstToolMs !== undefined ? row('prompt → первый инструмент', duration(round.firstToolMs)) : null,
        round?.continuations ? row('Продолжения после инструментов', round.continuations + ' раз · последнее ' + duration(round.lastContinuationMs)) : null,
        runtime.error ? h('p', { role: 'alert', style: { margin: '4px 0 0', color: '#b42318', overflowWrap: 'anywhere' } }, runtime.error) : null)
    }
    function SectionHeading({ eyebrow, title, description, action }) {
      return h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' } },
        h('div', { style: { flex: 1, minWidth: 0 } },
          eyebrow ? h('div', { style: { fontSize: '10px', fontWeight: 650, letterSpacing: '.08em', opacity: .5, marginBottom: '4px' } }, eyebrow) : null,
          h('h3', { style: { fontSize: '14px', lineHeight: 1.4, fontWeight: 650, margin: 0 } }, title),
          description ? h('p', { style: { fontSize: '12px', lineHeight: 1.6, opacity: .6, margin: '5px 0 0' } }, description) : null),
        action ?? null)
    }
    function TextField({ field, value, disabled, invalid, onChange }) {
      const inputId = 'agy-setting-' + (React.useId?.() ?? field.key) + '-' + field.key
      return h('div', { style: { display: 'grid', gap: '6px' } },
        h('label', { htmlFor: inputId, style: { fontSize: '12px', fontWeight: 550 } }, field.label),
        h('input', {
          id: inputId, name: field.key, type: field.numeric ? 'number' : 'text',
          ...(field.numeric ? { min: field.min, max: field.max, step: 1 } : {}),
          disabled, value: value ?? '', placeholder: field.placeholder,
          'aria-invalid': invalid || undefined, 'aria-describedby': inputId + '-hint',
          style: { ...ACTION, cursor: disabled ? 'not-allowed' : 'text', width: '100%', boxSizing: 'border-box', background: 'rgba(128,128,128,.035)', opacity: disabled ? .6 : 1 },
          onChange: (event) => onChange(field.numeric && event.target.value !== '' ? Number(event.target.value) : event.target.value),
        }),
        h('small', { id: inputId + '-hint', style: { fontSize: '11px', lineHeight: 1.6, opacity: .6 } }, field.hint))
    }
    function SwitchField({ field, checked, disabled, onChange }) {
      return h('label', { style: { display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: disabled ? 'default' : 'pointer', padding: '2px 0', opacity: disabled ? .6 : 1 } },
        h('input', { name: field.key, type: 'checkbox', checked: checked === true, disabled, onChange: (event) => onChange(event.target.checked), style: { width: '16px', height: '16px', flex: '0 0 auto', margin: '2px 0 0', accentColor: '#177c55', cursor: disabled ? 'not-allowed' : 'pointer' } }),
        h('span', { style: { display: 'grid', gap: '4px', minWidth: 0 } },
          h('span', { style: { fontSize: '12px', fontWeight: 550 } }, field.label),
          h('small', { style: { fontSize: '11px', lineHeight: 1.6, opacity: .65 } }, field.hint)))
    }
    function SettingsFields({ fields, draft, dirtyKeys, conflicts, disabled, editField }) {
      return h('div', { style: { display: 'grid', gap: '16px' } }, ...fields.map((field) => {
        const onChange = (value) => editField(field.key, value)
        return field.checkbox
          ? h(SwitchField, { key: field.key, field, checked: draft[field.key], disabled, onChange })
          : h(TextField, { key: field.key, field, value: draft[field.key], disabled, invalid: dirtyKeys.includes(field.key) && field.numeric && !Number.isSafeInteger(draft[field.key]), onChange })
      }))
    }

    /** 单行：显示开关 + 默认思考档位 + 显示名 + 官方 ID 映射。 */
    function ModelOverrideRow({ row, override, disabled, onEdit }) {
      const enabled = override.enabled !== false
      const inputId = 'agy-model-' + row.id.replace(/[^\w.-]/g, '_')
      const labelStyle = { fontSize: '11px', opacity: .6 }
      const inputStyle = { ...ACTION, width: '100%', minWidth: 0, boxSizing: 'border-box', background: 'rgba(128,128,128,.035)', cursor: disabled ? 'not-allowed' : 'text' }
      return h('div', { style: { display: 'grid', gap: '8px', padding: '12px', borderRadius: '10px', border: '1px solid rgba(128,128,128,.16)', opacity: enabled ? 1 : .62 } },
        h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '10px' } },
          h('label', { style: { display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1, minWidth: 0, cursor: disabled ? 'default' : 'pointer' } },
            h('input', { name: 'model-enabled-' + row.id, type: 'checkbox', checked: enabled, disabled,
              onChange: (event) => onEdit(row.id, { enabled: event.target.checked }),
              style: { width: '15px', height: '15px', flex: '0 0 auto', margin: '2px 0 0', accentColor: '#177c55', cursor: disabled ? 'not-allowed' : 'pointer' } }),
            h('span', { style: { display: 'grid', gap: '2px', minWidth: 0 } },
              h('span', { style: { fontSize: '12px', fontWeight: 600, overflowWrap: 'anywhere' } }, row.name),
              h('code', { style: { fontSize: '11px', opacity: .55, overflowWrap: 'anywhere' } }, row.id))),
          row.inCatalog
            ? (Array.isArray(row.inputModalities) && row.inputModalities.length
              ? h('span', { style: { flex: '0 0 auto', fontSize: '10px', padding: '2px 7px', borderRadius: '99px', background: TRACK } }, row.inputModalities.map((modality) => MODALITY_LABELS[modality] ?? modality).join(', '))
              : null)
            : h('span', { title: 'Этот ID взят из сохранённых настроек и отсутствует в текущем каталоге; его всё ещё можно изменить или удалить', style: { flex: '0 0 auto', fontSize: '10px', padding: '2px 7px', borderRadius: '99px', color: '#946200', background: 'rgba(217,155,40,.12)' } }, 'нет в текущем каталоге')),
        h('div', { style: { display: 'grid', gap: '6px', gridTemplateColumns: 'minmax(120px, 160px) minmax(0, 1fr)' } },
          h('div', { style: { display: 'grid', gap: '4px', minWidth: 0 } },
            h('label', { htmlFor: inputId + '-effort', style: labelStyle }, 'Уровень размышления по умолчанию'),
            h('select', { id: inputId + '-effort', name: 'model-effort-' + row.id, disabled, value: EFFORT_IDS.has(override.effort) ? override.effort : '',
              onChange: (event) => onEdit(row.id, { effort: event.target.value }),
              style: { ...inputStyle, cursor: disabled ? 'not-allowed' : 'pointer' } },
              ...EFFORT_OPTIONS.map((option) => h('option', { key: option.value, value: option.value }, option.label)))),
          h('div', { style: { display: 'grid', gap: '4px', minWidth: 0 } },
            h('label', { htmlFor: inputId + '-target', style: labelStyle }, 'Сопоставить с официальным ID модели'),
            h('input', { id: inputId + '-target', name: 'model-target-' + row.id, type: 'text', disabled, value: override.target ?? '',
              placeholder: 'пусто — авто-маршрутизация по семейству и уровню', onChange: (event) => onEdit(row.id, { target: event.target.value }), style: inputStyle }))),
        h('div', { style: { display: 'grid', gap: '4px' } },
          h('label', { htmlFor: inputId + '-name', style: labelStyle }, 'Отображаемое имя'),
          h('input', { id: inputId + '-name', name: 'model-name-' + row.id, type: 'text', disabled, value: override.name ?? '',
            placeholder: row.inCatalog ? 'пусто — использовать «' + row.name + '»' : 'пусто — показывать ID модели', onChange: (event) => onEdit(row.id, { name: event.target.value }), style: inputStyle })))
    }

    /**
     * 模型列表：一次列出目录中的每个模型，改动在保存时合并成一份
     * `modelOverrides` 提交，空项自动清除，不留空壳配置。
     */
    function ModelOverrideList({ rows, overrides, disabled, onEdit }) {
      if (rows.length === 0) {
        return h('p', { style: { margin: 0, fontSize: '12px', lineHeight: 1.6, opacity: .6 } },
          'Каталог моделей пока пуст. После подключения, входа в ACP или обновления каталога здесь можно настроить видимость, уровень размышления и сопоставление для каждой модели.')
      }
      const hidden = rows.filter((row) => overrideFor(overrides, row.id).enabled === false).length
      return h('div', { style: { display: 'grid', gap: '10px' } },
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: '11px', opacity: .62 } },
          h('span', null, rows.length + ' моделей'),
          hidden ? h('span', null, hidden + ' скрыто из селектора') : null,
          h('span', null, 'Сопоставление и имя применяются после сохранения; выбранная в сессии модель не меняется')),
        // 全部停用时本 provider 会从 DSH 选择器里消失，这里必须说清原因。
        hidden === rows.length
          ? h('p', { role: 'status', style: { margin: 0, fontSize: '11px', lineHeight: 1.6, color: '#946200' } },
            'Все модели скрыты: после сохранения Antigravity исчезнет из селектора моделей DSH. Включите любую модель, чтобы вернуть.')
          : null,
        ...rows.map((row) => h(ModelOverrideRow, {
          key: row.id, row, override: overrideFor(overrides, row.id), disabled,
          onEdit: (id, patch) => onEdit(id, patch),
        })))
    }

    function AntigravitySettingsCard(props) {
      const remote = props.remote
      const [account, setAccount] = React.useState(undefined)
      const [models, setModels] = React.useState([])
      const [modelBusy, setModelBusy] = React.useState(false)
      const [modelMessage, setModelMessage] = React.useState('')
      const alive = React.useRef(true)
      const modelVersion = React.useRef(0)
      const accountVersion = React.useRef(0)
      const polling = React.useRef(false)
      const manualModelPull = React.useRef(false)
      const pullModels = React.useCallback(async (force = false) => {
        if (!props.control || manualModelPull.current) return
        if (force) manualModelPull.current = true
        const version = ++modelVersion.current
        setModelBusy(true)
        if (force) setModelMessage('Загрузка каталога моделей…')
        try {
          const value = unwrap(await props.control('models', force ? { force: true } : undefined))
          if (!alive.current || version !== modelVersion.current) return
          setModels(value.models ?? [])
          setModelMessage(value.status === 'error' ? value.message : (value.models?.length ? 'Каталог обновлён; выбранная модель текущей сессии не заменяется автоматически.' : 'Каталог моделей отсутствует. Подключение или вход в ACP проверит сессию и прочитает каталог; можно также взять его из уже авторизованного официального CLI.'))
        } catch (error) { if (alive.current && version === modelVersion.current) setModelMessage(error instanceof Error ? error.message : String(error)) }
        finally {
          if (force) manualModelPull.current = false
          if (alive.current && version === modelVersion.current) setModelBusy(false)
        }
      }, [props.control])
      const accountAction = React.useCallback(async (action = 'status') => {
        if (!props.control) return
        if (action === 'status' && polling.current) return
        polling.current = true
        const version = ++accountVersion.current
        try {
          const value = unwrap(await props.control('account', { action }))
          if (alive.current && version === accountVersion.current) setAccount(value)
        } catch (error) { if (alive.current && version === accountVersion.current) setAccount({ state: 'error', message: error instanceof Error ? error.message : String(error) }) }
        finally { polling.current = false }
      }, [props.control])
      React.useEffect(() => {
        alive.current = true
        void accountAction('status')
        void pullModels(false)
        return () => { alive.current = false; ++modelVersion.current; ++accountVersion.current }
      }, [accountAction, pullModels])
      React.useEffect(() => {
        const timer = setInterval(() => {
          if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void accountAction('status')
        }, 2000)
        return () => clearInterval(timer)
      }, [accountAction])
      React.useEffect(() => {
        if (account?.state === 'connected' || account?.runtime?.modelCatalogRevision !== undefined) void pullModels(false)
      }, [account?.state, account?.runtime?.modelCatalogRevision, pullModels])
      const [view, setView] = React.useState(undefined)
      const [registered, setRegistered] = React.useState(undefined)
      const [draft, setDraft] = React.useState({})
      const [status, setStatus] = React.useState(null)
      const [loading, setLoading] = React.useState(true)
      const [writable, setWritable] = React.useState(false)
      const [saving, setSaving] = React.useState(false)
      const [dirtyKeys, setDirtyKeys] = React.useState([])
      const [conflicts, setConflicts] = React.useState([])
      const settingsVersion = React.useRef(0)
      const savingRef = React.useRef(false)
      const refreshAfterSave = React.useRef(false)
      const baseline = React.useRef({})
      const dirty = React.useRef(new Set())
      const draftRef = React.useRef(draft)
      draftRef.current = draft

      const editField = React.useCallback((key, value) => {
        if (savingRef.current) return
        const next = { ...draftRef.current, [key]: value }
        draftRef.current = next
        if (value === baseline.current[key]) dirty.current.delete(key)
        else dirty.current.add(key)
        setDirtyKeys([...dirty.current])
        setConflicts((previous) => previous.filter((field) => field !== key))
        setDraft(next)
      }, [])

      /**
       * 单条模型设置：合并成整份 modelOverrides 再交给通用编辑路径，
       * 这样草稿、冲突与只提交改动项的行为和其它字段完全一致。
       */
      const editOverride = React.useCallback((id, patch) => {
        if (savingRef.current) return
        const current = overrideFor(draftRef.current[OVERRIDES_KEY], id)
        const merged = canonicalOverride({ ...current, ...patch })
        const overrides = canonicalOverrides(draftRef.current[OVERRIDES_KEY])
        if (Object.keys(merged).length === 0) delete overrides[id]
        else overrides[id] = merged
        const value = overrides
        const next = { ...draftRef.current, [OVERRIDES_KEY]: value }
        draftRef.current = next
        if (sameOverrides(value, baseline.current[OVERRIDES_KEY])) dirty.current.delete(OVERRIDES_KEY)
        else dirty.current.add(OVERRIDES_KEY)
        setDirtyKeys([...dirty.current])
        setConflicts((previous) => previous.filter((field) => field !== OVERRIDES_KEY))
        setDraft(next)
      }, [])

      const reload = React.useCallback(async (preserveStatus = false) => {
        const version = ++settingsVersion.current
        // 同步段整体兜底：remote.<ns> 是代理属性，缺 inject 时连「读属性」都会抛；
        // 这里降级为卡片内可读错误，绝不让异常穿出组件击穿 settings.section。
        try {
          if (!remote?.settings?.describe) {
            setStatus({ kind: 'error', text: 'Хост не предоставил settings.describe, редактирование настроек здесь невозможно' })
            setLoading(false)
            return
          }
          setLoading(true)
          const described = Promise.resolve(remote.settings.describe()).then(unwrap)
          const providers = Promise.resolve(remote.llm?.listProviders?.())
            .then((value) => unwrap(value))
            .catch(() => [])
            .then((rows) => (Array.isArray(rows) ? rows : []))
          const [settings, rows] = await Promise.all([described, providers])
          if (!alive.current || version !== settingsVersion.current) return
          const namespaces = Array.isArray(settings?.namespaces) ? settings.namespaces : []
          // 只按精确 namespace 匹配：按字段回退会命中别人的配置，而保存用的
          // revision 也必须来自同一份文档（同 profile 的 dsh-proxy 即如此）。
          const found = namespaces.find((item) => item?.ns === ENTRY_ID)
          setView(found ?? null)
          const current = found?.value && typeof found.value === 'object' ? found.value : {}
          const server = Object.fromEntries(FIELDS.map((field) => [field.key, field.checkbox ? (field.defaultChecked ? current[field.key] !== false : current[field.key] === true) : current[field.key] ?? field.defaultValue ?? '']))
          // 整份 map 作为一个字段参与脏值比较；规范化后再比，避免键序或
          // 「显式写回默认值」被误判为未保存修改。
          server[OVERRIDES_KEY] = canonicalOverrides(current[OVERRIDES_KEY])
          const changed = []
          const next = { ...server }
          for (const key of dirty.current) {
            const same = key === OVERRIDES_KEY
              ? sameOverrides(draftRef.current[key], server[key])
              : draftRef.current[key] === server[key]
            if (same) dirty.current.delete(key)
            else {
              next[key] = draftRef.current[key]
              const beforeSame = key === OVERRIDES_KEY
                ? sameOverrides(baseline.current[key], server[key])
                : baseline.current[key] === server[key]
              if (!beforeSame) changed.push(key)
            }
          }
          baseline.current = server
          draftRef.current = next
          setDraft(next)
          setDirtyKeys([...dirty.current])
          setConflicts((previous) => [...new Set([...previous.filter((key) => dirty.current.has(key)), ...changed])])
          setWritable(settings?.writable === true)
          setRegistered(rows.some((row) => row?.id === PROVIDER))
          if (!found) setStatus({ kind: 'error', text: 'Хост пока не предоставил редактируемые настройки Antigravity ACP. Убедитесь, что версии плагина Host и Client совпадают, перезагрузите плагин и обновите конфигурацию.' })
          else if (!preserveStatus) setStatus(null)
        } catch (cause) {
          if (alive.current && version === settingsVersion.current) setStatus({ kind: 'error', text: cause instanceof Error ? cause.message : String(cause) })
        } finally {
          if (alive.current && version === settingsVersion.current) setLoading(false)
        }
      }, [remote])

      const save = React.useCallback(async () => {
        if (!view || !writable || loading || savingRef.current || dirty.current.size === 0) return
        const invalid = FIELDS.find((field) => field.numeric && dirty.current.has(field.key)
          && (!Number.isSafeInteger(draftRef.current[field.key]) || draftRef.current[field.key] < field.min || draftRef.current[field.key] > field.max))
        if (invalid) {
          setStatus({ kind: 'error', text: invalid.label + 'должно быть ' + invalid.min + '–' + invalid.max + ' — целое число.' })
          return
        }
        savingRef.current = true
        setSaving(true)
        setStatus({ kind: 'busy', text: 'Сохранение…' })
        // 只提交用户改动过的字段，空串也是有效改动；未编辑字段遵循最新服务端值。
        // modelOverrides 是整份 map 一个字段，按同样方式提交。
        const ops = [...FIELDS.map((field) => field.key), OVERRIDES_KEY]
          .filter((key) => dirty.current.has(key))
          .map((key) => ({ op: 'set', path: [key], value: draftRef.current[key] }))
        try {
          unwrap(await remote.settings.mutate(ENTRY_ID, ops, view.revision))
          if (!alive.current) return
          for (const operation of ops) {
            const key = operation.path[0]
            if (draftRef.current[key] === operation.value) dirty.current.delete(key)
          }
          setDirtyKeys([...dirty.current])
          setConflicts([])
          setStatus({ kind: 'ok', text: 'Сохранено. Предпочтения сессии применяются со следующего хода; прокси используется для последующих запросов и новых процессов ACP, а уже запущенный процесс потребует перезагрузки плагина. Автопрогрев включится при следующем включении плагина; выбранная модель не меняется.' })
          await reload(true)
        } catch (cause) {
          if (!alive.current) return
          setStatus({ kind: 'error', text: cause instanceof Error ? cause.message : String(cause) })
          // 修订号冲突时同步新基线，仍保留本地草稿，供用户检查后再次保存。
          await reload(true)
        } finally {
          savingRef.current = false
          if (alive.current) {
            setSaving(false)
            if (refreshAfterSave.current) { refreshAfterSave.current = false; void reload(true) }
          }
        }
      }, [loading, writable, remote, reload, view])

      React.useEffect(() => {
        reload()
        const off = remote?.$on?.('settings/document-updated', (ns) => {
          if (!ns || ns === ENTRY_ID) {
            if (savingRef.current) refreshAfterSave.current = true
            else void reload()
          }
        })
        return () => {
          ++settingsVersion.current
          if (typeof off === 'function') off()
        }
      }, [reload, remote])

      // 目录条目 + 已配置但目录里暂时没有的 ID：正在编辑的映射不能因为目录刷新而消失。
      const rows = modelRows(models, draft[OVERRIDES_KEY])
      const editingDisabled = loading || saving || !view || !writable
      const discardDraft = () => {
        if (savingRef.current) return
        dirty.current.clear()
        draftRef.current = { ...baseline.current }
        setDraft(draftRef.current)
        setDirtyKeys([])
        setConflicts([])
        setStatus({ kind: 'ok', text: 'Несохранённые изменения отменены, восстановлены текущие настройки хоста.' })
      }

      const connection = connectionStatus(account, registered)
      const fieldsFor = (group) => FIELDS.filter((field) => field.group === group)
      const fieldProps = { draft, dirtyKeys, conflicts, disabled: editingDisabled, editField }
      const busy = ['connecting', 'cancelling'].includes(account?.state) || runtimeBusy(account?.runtime)
      const readonly = !loading && view && !writable
      const advancedSummary = h('summary', { style: SUMMARY },
        h('span', { style: { display: 'grid', gap: '4px' } },
          h('span', { style: { fontSize: '13px', fontWeight: 650 } }, 'Дополнительно'),
          h('small', { style: { fontSize: '11px', fontWeight: 400, opacity: .6 } }, 'Сеть, CLI, восстановление сессий и жизненный цикл процессов')))

      return h('div', { style: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '720px', boxSizing: 'border-box', lineHeight: 1.5 } },
        h('header', { style: { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '0 2px 2px' } },
          h('div', { style: { flex: 1, minWidth: 0 } },
            h('div', { style: { fontSize: '10px', fontWeight: 650, letterSpacing: '.1em', opacity: .5, marginBottom: '5px' } }, 'MODEL PROVIDER'),
            h('h2', { style: { margin: 0, fontSize: '20px', lineHeight: 1.35, fontWeight: 650, letterSpacing: '-.015em' } }, 'Antigravity ACP'),
            h('p', { style: { margin: '6px 0 0', fontSize: '12px', opacity: .6 } }, 'Подключение к официальному Antigravity; модели и инструменты по-прежнему под управлением DSH.')),
          h('span', { title: 'Маршрут Provider: ' + PROVIDER, style: { flex: '0 0 auto', padding: '4px 9px', borderRadius: '99px', fontSize: '11px', color: registered === false ? '#b42318' : registered === true ? '#177c55' : 'inherit', background: registered === false ? 'rgba(217,119,87,.10)' : registered === true ? 'rgba(37,184,121,.10)' : TRACK } }, registered === false ? 'не зарегистрирован' : registered === true ? 'Provider зарегистрирован' : 'проверка маршрута')),

        readonly ? h(StatusNotice, { status: { kind: 'busy', text: 'Текущие настройки только для чтения. Состояние соединения и диагностику смотреть можно; изменяйте конфигурацию на хосте с правом записи.' } }) : null,

        h('section', { style: PANEL, 'aria-label': 'Подключение аккаунта' },
          h(SectionHeading, { eyebrow: '01 · Подключение', title: 'Аккаунт и соединение', description: 'Сначала прогрейте, чтобы не ждать, либо проверьте аккаунт и прочитайте каталог моделей.' }),
          h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', borderRadius: '10px', background: 'rgba(128,128,128,.045)', marginBottom: '14px' } },
            h(StatusDot, { color: connection.color }),
            h('div', { style: { minWidth: 0 } },
              h('div', { style: { fontSize: '12px', fontWeight: 650, color: connection.color } }, connection.label),
              h('p', { role: 'status', style: { fontSize: '12px', lineHeight: 1.6, opacity: .7, overflowWrap: 'anywhere', margin: '3px 0 0' } }, connection.description))),
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } },
            h('button', { type: 'button', style: PRIMARY, disabled: !props.control || busy, onClick: () => accountAction('login') }, account?.state === 'connecting' ? 'Подключение…' : 'Подключить / войти в ACP'),
            h('button', { type: 'button', style: ACTION, disabled: !props.control || busy || connection.ready, onClick: () => accountAction('warmup') }, connection.ready ? 'прогрет' : 'Прогреть сразу'),
            ['connecting', 'cancelling'].includes(account?.state) ? h('button', { type: 'button', style: ACTION, disabled: account?.state === 'cancelling', onClick: () => accountAction('cancel') }, account?.state === 'cancelling' ? 'Отмена…' : 'Отменить подключение') : null),
          h('p', { style: { opacity: .55, fontSize: '11px', lineHeight: 1.6, margin: '10px 0 0' } }, 'Прогрев не отправляет сообщений в чат. Страница авторизации открывается только если нужен вход; уровень размышления по-прежнему задаётся в меню сессии.')),

        h('section', { style: PANEL, 'aria-label': 'Список моделей' },
          h(SectionHeading, { eyebrow: '02 · Модели', title: 'Список моделей', description: 'Какие модели каталога попадают в селектор DSH, их уровень размышления по умолчанию и сопоставление с официальными ID.',
            action: h('button', { type: 'button', title: 'Перечитать каталог моделей из официального CLI или ACP-сессии', 'aria-busy': modelBusy || undefined, style: { ...ACTION, flex: '0 0 auto', whiteSpace: 'nowrap' }, disabled: modelBusy || !props.control, onClick: () => pullModels(true) }, modelBusy ? 'Обновление…' : 'Обновить каталог моделей') }),
          h(ModelOverrideList, { rows: rows, overrides: draft[OVERRIDES_KEY], disabled: editingDisabled, onEdit: editOverride }),
          modelMessage ? h('p', { role: 'status', style: { fontSize: '11px', lineHeight: 1.6, opacity: .65, margin: '10px 0 0', overflowWrap: 'anywhere' } }, modelMessage) : null),

        h('section', { style: PANEL, 'aria-label': 'Основные настройки' },
          h(SectionHeading, { eyebrow: '03 · Предпочтения', title: 'Основные настройки', description: 'Подходит для большинства случаев; остальные параметры можно оставить по умолчанию.' }),
          h(SettingsFields, { ...fieldProps, fields: fieldsFor('general') })),

        h('details', { style: PANEL, 'aria-label': 'Дополнительно' }, advancedSummary,
          h('div', { style: { display: 'grid', gap: '24px', marginTop: '20px', paddingTop: '18px', borderTop: '1px solid rgba(128,128,128,.14)' } },
            h('section', { 'aria-label': 'Настройки сети и CLI', style: { display: 'grid', gap: '16px' } },
              h('h4', { style: { margin: 0, fontSize: '12px', fontWeight: 650 } }, 'Сеть и CLI'),
              h(SettingsFields, { ...fieldProps, fields: fieldsFor('network') })),
            h('section', { 'aria-label': 'Настройки сессий и процессов', style: { display: 'grid', gap: '16px' } },
              h('h4', { style: { margin: 0, fontSize: '12px', fontWeight: 650 } }, 'Сессии и процессы'),
              h(SettingsFields, { ...fieldProps, fields: fieldsFor('advanced') })))),

        h('details', { style: PANEL, 'aria-label': 'Диагностика соединения' },
          h('summary', { style: SUMMARY },
            h('span', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
              h(StatusDot, { color: connection.color }),
              h('span', { style: { fontSize: '13px', fontWeight: 650 } }, 'Диагностика соединения')),
            h('small', { style: { fontSize: '11px', opacity: .6 } }, 'Состояние, параллельность и тайминги')),
          h('div', { style: { marginTop: '18px', paddingTop: '16px', borderTop: '1px solid rgba(128,128,128,.14)' } },
            account?.runtime ? RuntimeDetails({ runtime: account.runtime }) : h('p', { style: { margin: 0, fontSize: '12px', opacity: .6 } }, 'После подключения здесь появятся жизненный цикл, ёмкость и тайминги по этапам.'))),

        h('footer', { style: { display: 'grid', gap: '10px', padding: '4px 2px 0' } },
          conflicts.length ? h('p', { role: 'alert', style: { margin: 0, fontSize: '12px', lineHeight: 1.6, color: '#946200' } }, 'Настройки ниже изменены в другом месте, ваши введённые значения сохранены: ' + conflicts.map((key) => key === OVERRIDES_KEY ? OVERRIDES_LABEL : FIELDS.find((field) => field.key === key)?.label ?? key).join(', ') + '. Сверьте и сохраните.') : null,
          h(StatusNotice, { status }),
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' } },
            h('button', { type: 'button', onClick: save, disabled: editingDisabled || dirtyKeys.length === 0, style: PRIMARY }, saving ? 'Сохранение…' : 'Сохранить'),
            dirtyKeys.length ? h('button', { type: 'button', disabled: loading || saving, onClick: discardDraft, style: ACTION }, 'Отменить несохранённые') : null,
            h('button', { type: 'button', title: 'Перечитать конфигурацию хоста, сохранив несохранённые введённые значения', disabled: loading || saving, onClick: () => reload(), style: { ...ACTION, borderColor: 'transparent', background: 'transparent', opacity: .7, marginLeft: 'auto' } }, loading ? 'Обновление…' : 'Обновить конфигурацию')),
          dirtyKeys.length ? h('p', { role: 'status', style: { margin: 0, fontSize: '11px', opacity: .65 } }, 'Есть ' + dirtyKeys.length + ' несохранённых изменений; обновление сохранит введённые значения.') : null,
          h('p', { style: { margin: '2px 0 0', paddingTop: '12px', borderTop: '1px solid rgba(128,128,128,.12)', fontSize: '11px', lineHeight: 1.6, opacity: .55 } }, 'Квоты тарифа и AI Credits смотрите в «пилюле» рядом с полем ввода — здесь они не дублируются.')))
    }

    /**
     * 额度药丸：只在当前会话模型属于 antigravity-acp 时出现，位置是
     * `conversation.input.right`（宿主 InputBar 里它渲染在模型选择器之前，
     * 即「Provider 选择器左边」）。取数经 Host 的 remote.agyQuota.read。
     */
    const PILL_ID = 'antigravity-quota'

    const TRACK = 'rgba(128,128,128,.18)'
    const CARD = { padding: '12px', borderRadius: '12px', border: '1px solid rgba(128,128,128,.18)', background: 'rgba(128,128,128,.05)' }
    const PANEL = { padding: '18px', borderRadius: '14px', border: '1px solid rgba(128,128,128,.16)', background: 'rgba(128,128,128,.025)' }
    const SUMMARY = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', cursor: 'pointer', listStyle: 'none' }
    const ACTION = { padding: '7px 12px', minHeight: '34px', borderRadius: '8px', border: '1px solid rgba(128,128,128,.22)', background: 'rgba(128,128,128,.06)', color: 'inherit', font: 'inherit', fontSize: '12px', cursor: 'pointer' }
    const PRIMARY = { ...ACTION, background: '#177c55', border: '1px solid #177c55', color: '#fff', fontWeight: 600 }
    const GROUPS = [{ key: 'gemini', name: 'Gemini' }, { key: 'claude', name: 'Claude / GPT' }, { key: 'argon', name: 'Gemini 4 Argon' }]
    function groupKey(name) {
      const text = String(name ?? '').toLowerCase()
      if (/\bargon\b/.test(text)) return 'argon'
      if (/\bgemini\b/.test(text)) return 'gemini'
      if (/\b(claude|gpt)\b/.test(text)) return 'claude'
      return undefined
    }
    function modelGroup(model) {
      const id = String(model ?? '').toLowerCase()
      if (/^gemini-/.test(id) && /(?:^|-)argon(?:-|$)/.test(id)) return 'argon'
      if (/^gemini-/.test(id)) return 'gemini'
      if (/^(claude|gpt)-/.test(id)) return 'claude'
      return undefined
    }
    function quotaGroups(data) {
      const groups = Array.isArray(data?.groups) ? data.groups : []
      return GROUPS.map((entry) => ({ ...entry, buckets: groups.filter((g) => groupKey(g.name) === entry.key).flatMap((g) => g.buckets ?? []) }))
        .concat(groups.filter((g) => !groupKey(g.name)).map((g, i) => ({ ...g, key: 'other-' + i })))
    }
    function percentage(bucket) {
      return Number.isFinite(bucket?.remainingPct) ? Math.max(0, Math.min(100, bucket.remainingPct)) : undefined
    }
    function tone(bucket, stale) {
      const value = percentage(bucket)
      if (bucket?.disabled || value === undefined) return '#8b909a'
      if (value <= 10) return '#ef4444'
      if (value <= 25 || stale) return '#d99b28'
      return '#25b879'
    }
    function windowName(bucket) {
      return ({ '5h': '5 часов', weekly: 'неделя', '7d': 'неделя' })[bucket.window] ?? bucket.window ?? bucket.name ?? 'окно квоты'
    }
    function resetCountdown(value) {
      const seconds = Math.ceil((Date.parse(value) - Date.now()) / 1000)
      if (!Number.isFinite(seconds)) return 'время сброса не указано'
      if (seconds <= 0) return 'время сброса наступило, ждёт обновления'
      const minutes = Math.ceil(seconds / 60)
      if (minutes >= 1440) return Math.floor(minutes / 1440) + ' д ' + Math.floor(minutes % 1440 / 60) + ' ч до сброса'
      if (minutes >= 60) return Math.floor(minutes / 60) + ' ч ' + minutes % 60 + ' мин до сброса'
      return minutes + ' мин до сброса'
    }
    function remainingBar(bucket, compact, stale, label) {
      const pct = percentage(bucket)
      const unknown = pct === undefined || bucket.disabled
      return h('span', {
        role: 'progressbar', 'aria-label': label,
        'aria-valuemin': 0, 'aria-valuemax': 100,
        ...(unknown ? { 'aria-valuetext': bucket.disabled ? 'отключено' : 'квота неизвестна' } : { 'aria-valuenow': pct }),
        style: { display: 'block', width: compact ? '30px' : '100%', height: compact ? '4px' : '6px', borderRadius: '99px', overflow: 'hidden', background: TRACK },
      }, h('span', { style: { display: 'block', height: '100%', width: unknown ? '100%' : pct + '%', opacity: unknown ? .35 : 1, borderRadius: '99px', background: tone(bucket, stale) } }))
    }
    function useQuota(readQuota, enabled = true) {
      const [data, setData] = React.useState(null)
      const [refreshing, setRefreshing] = React.useState(false)
      const version = React.useRef(0)
      const update = React.useCallback((value) => setData(value), [])
      const load = React.useCallback((force = false) => {
        if (!enabled || !readQuota) return Promise.resolve()
        const current = ++version.current
        setRefreshing(true)
        return Promise.resolve().then(() => readQuota(force)).then(unwrap).then((value) => {
          if (current === version.current) update(value)
        }).catch((error) => {
          if (current === version.current) {
            const message = error instanceof Error ? error.message : String(error)
            setData((previous) => previous?.status === 'ok'
              ? { ...previous, stale: true, staleReason: message }
              : { status: 'error', groups: [], error: { message } })
          }
        }).finally(() => { if (current === version.current) setRefreshing(false) })
      }, [readQuota, enabled, update])
      React.useEffect(() => {
        if (!enabled || !readQuota) { setData(null); return undefined }
        void load(false)
        const off = readQuota.subscribe?.((value) => { ++version.current; update(value) })
        const timer = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void load(false) }, 300_000)
        return () => { ++version.current; clearInterval(timer); off?.() }
      }, [load, enabled, readQuota, update])
      return { data, refreshing, load }
    }
    function CreditsDetails({ credits, pending }) {
      const valid = credits?.status === 'ok' && Number.isSafeInteger(credits.remainingCredits) && credits.remainingCredits >= 0
      const label = valid ? credits.remainingCredits.toLocaleString() : pending ? 'Чтение…' : credits?.status === 'error' ? 'ошибка запроса' : 'не указано'
      return h('section', { style: CARD, 'aria-label': 'Баланс AI Credits' },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' } },
          h('strong', null, 'Баланс AI Credits'),
          h('strong', { style: { fontSize: valid ? '20px' : '13px', fontVariantNumeric: 'tabular-nums', color: credits?.stale ? '#d99b28' : 'inherit' } }, label)),
        credits?.planName ? h('div', { style: { fontSize: '11px', opacity: .7, marginTop: '6px' } }, 'Тариф: ' + credits.planName) : null,
        credits?.stale ? h('p', { role: 'status', style: { margin: '6px 0 0', fontSize: '11px', color: '#d99b28' } }, 'кеш баланса · ' + (credits.staleReason ?? 'не удалось обновить баланс')) : null,
        credits?.error?.message ? h('p', { role: credits.status === 'error' ? 'alert' : 'status', style: { margin: '6px 0 0', fontSize: '11px', overflowWrap: 'anywhere' } }, credits.error.message) : null,
        credits?.updatedAt ? h('div', { style: { marginTop: '6px', fontSize: '10px', opacity: .55 } }, (valid ? 'баланс обновлён ' : 'последний запрос ') + new Date(credits.updatedAt).toLocaleString()) : null)
    }
    function QuotaDetails({ data, refreshing, load, model }) {
      return h('div', { style: { display: 'grid', gap: '12px' } },
        h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
          h('strong', { style: { fontSize: '14px', flex: 1 } }, 'Antigravity · квоты тарифа'),
          data?.plan ? h('span', { style: { fontSize: '11px', padding: '2px 8px', background: TRACK, borderRadius: '99px' } }, data.plan) : null),
        data?.stale ? h('p', { role: 'status', style: { ...CARD, margin: 0, color: '#d99b28', fontSize: '12px' } }, 'кешированные данные · ' + (data.staleReason ?? 'обновление не удалось')) : null,
        data?.status === 'error' ? h('p', { role: 'alert', style: { margin: 0, color: '#ef4444', overflowWrap: 'anywhere' } }, data.error?.message ?? data.error?.text ?? 'не удалось прочитать квоту') : null,
        ...quotaGroups(data).map((group) => h('section', { key: group.key, style: CARD, 'aria-label': group.name + 'квота' },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' } },
            h('strong', { style: { fontSize: '13px' } }, group.name),
            group.key === modelGroup(model) ? h('span', { style: { fontSize: '10px', padding: '2px 6px', borderRadius: '6px', color: '#25b879', background: 'rgba(37,184,121,.12)' } }, 'текущая модель') : null),
          group.buckets.length ? h('div', { style: { display: 'grid', gap: '12px' } }, ...group.buckets.map((bucket, index) => {
            const pct = percentage(bucket)
            return h('div', { key: index },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', marginBottom: '6px' } },
                h('span', { style: { fontSize: '12px', opacity: .75 } }, windowName(bucket)),
                h('strong', { style: { fontSize: '16px', fontVariantNumeric: 'tabular-nums' } }, bucket.disabled ? 'отключено' : pct === undefined ? 'неизвестно' : Math.round(pct) + '%', h('small', { style: { fontSize: '10px', fontWeight: 400, opacity: .6, marginLeft: '4px' } }, 'остаток'))),
              remainingBar(bucket, false, data?.stale, group.name + ' ' + windowName(bucket) + 'остаток квоты'),
              h('div', { title: bucket.resetTime, style: { fontSize: '10px', opacity: .6, marginTop: '5px' } }, bucket.disabled ? bucket.description ?? 'это окно недоступно' : resetCountdown(bucket.resetTime)))
          })) : h('span', { style: { opacity: .55, fontSize: '12px' } }, data ? 'данные о квотах не предоставлены' : 'Чтение…'))),
        CreditsDetails({ credits: data?.credits, pending: !data }),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
          h('small', { style: { flex: 1, opacity: .55, minWidth: 0 } }, data?.updatedAt ? 'обновлено ' + new Date(data.updatedAt).toLocaleString() : 'успешных снимков ещё нет'),
          h('button', { type: 'button', disabled: refreshing || !load, onClick: () => load(true), style: ACTION }, refreshing ? 'Обновление…' : 'Обновить квоты')))
    }
    function useAcpWarmup(control, enabled) {
      const [account, setAccount] = React.useState(undefined)
      const [pending, setPending] = React.useState(false)
      const alive = React.useRef(false)
      const version = React.useRef(0)
      const polling = React.useRef(false)
      const run = React.useCallback(async (action = 'status') => {
        if (!control || !enabled || (action === 'status' && polling.current)) return
        const current = ++version.current
        polling.current = true
        if (action === 'warmup') setPending(true)
        try {
          const value = unwrap(await control('account', { action }))
          if (alive.current && current === version.current) setAccount(value)
        } catch (error) {
          if (alive.current && current === version.current) setAccount({ state: 'error', message: error instanceof Error ? error.message : String(error) })
        } finally {
          polling.current = false
          if (alive.current && action === 'warmup') setPending(false)
        }
      }, [control, enabled])
      React.useEffect(() => {
        alive.current = true
        if (!enabled) return () => { alive.current = false; ++version.current }
        void run()
        const timer = setInterval(() => {
          if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void run()
        }, 2000)
        return () => { alive.current = false; ++version.current; clearInterval(timer) }
      }, [run, enabled])
      return { account, pending, run }
    }
    function AgYQuotaPill({ store, readQuota, control }) {
      const state = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
      const enabled = state?.current?.provider === PROVIDER
      const model = state?.current?.model
      const quota = useQuota(readQuota, enabled)
      const [expanded, setExpanded] = React.useState(false)
      const [position, setPosition] = React.useState(null)
      const root = React.useRef(null)
      const button = React.useRef(null)
      const warmup = useAcpWarmup(control, enabled && Boolean(control))
      React.useEffect(() => { setExpanded(false) }, [enabled])
      React.useEffect(() => {
        if (!expanded) { setPosition(null); return undefined }
        const reposition = () => {
          if (!button.current?.getBoundingClientRect) return
          const rect = button.current.getBoundingClientRect()
          const viewport = document.documentElement.clientWidth
          const height = window.innerHeight
          const width = Math.min(340, viewport - 24)
          const above = rect.top - 20
          const below = height - rect.bottom - 20
          setPosition({ position: 'fixed', right: 'auto', width,
            left: Math.max(12, Math.min(rect.right - width, viewport - width - 12)),
            ...(above >= Math.min(480, below)
              ? { bottom: height - rect.top + 8, maxHeight: Math.max(32, above) }
              : { bottom: 'auto', top: rect.bottom + 8, maxHeight: Math.max(32, below) }),
          })
        }
        reposition()
        window.addEventListener('resize', reposition)
        window.addEventListener('scroll', reposition, true)
        const outside = (event) => { if (!root.current?.contains(event.target)) setExpanded(false) }
        const key = (event) => { if (event.key === 'Escape') { setExpanded(false); button.current?.focus() } }
        document.addEventListener('pointerdown', outside)
        document.addEventListener('keydown', key)
        return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition, true) }
      }, [expanded])
      if (!enabled) return null
      const groups = quotaGroups(quota.data)
      const family = modelGroup(model)
      // 官方 /usage 可能只报告 Gemini 共享额度；只有真实 Argon 分组存在时，
      // 才把 Argon 型号绑定到独立组，不能命中一个预建的空组而误报未知。
      const group = groups.find((g) => g.key === family && (family !== 'argon' || g.buckets.length > 0))
        ?? (family === 'argon' ? groups.find((g) => g.key === 'gemini') : undefined)
      const buckets = group?.buckets ?? []
      const label = quota.data?.status === 'error' ? 'не удалось прочитать квоту' : !quota.data ? 'чтение квоты' : !group ? 'квота не сопоставлена — выберите конкретную модель' : !buckets.length ? 'квота неизвестна' : buckets.map((b) => windowName(b) + ' ' + (b.disabled ? 'отключено' : percentage(b) === undefined ? 'квота неизвестна' : Math.round(percentage(b)) + '% осталось')).join(' · ')
      const title = String(model ?? 'модель не выбрана') + ' · ' + label + (quota.data?.stale ? ' · кешированные данные' : '')
      const runtime = warmup.account?.runtime
      const warming = warmup.pending || ['connecting', 'cancelling'].includes(warmup.account?.state)
        || ['binary', 'credentials', 'spawn', 'initialize', 'authenticate'].includes(runtime?.phase)
      const working = !warming && runtimeBusy(runtime)
      const ready = runtime?.phase === 'ready'
      const failed = warmup.account?.state === 'error' || runtime?.phase === 'error'
      const warmupLabel = warming ? 'прогрев…' : runtime?.queue?.waiting > 0 ? 'в очереди ' + runtime.queue.waiting : working ? 'работает' : ready ? 'прогрет' : failed ? 'повторить прогрев' : 'прогрев'
      const warmupTitle = runtime ? (RUNTIME_PHASES[runtime.phase] ?? runtime.phase) + ' · ' + duration(runtime.phaseElapsedMs)
        + (runtime.queue ? ' · активных ' + runtime.queue.active + ' · ждут инструмент ' + runtime.queue.parked + ' · в очереди ' + runtime.queue.waiting : '')
        + (runtime.error ? ' · ' + runtime.error : '') : warmup.account?.message ?? 'заранее поднять ACP-соединение, не отправляя сообщений модели'
      return h('span', { ref: root, style: { position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '6px' } },
        h('button', { ref: button, type: 'button', title, 'aria-label': title, 'aria-expanded': expanded, 'aria-haspopup': 'dialog', onClick: () => setExpanded((value) => !value),
          style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '6px 10px', minHeight: '26px', borderRadius: '99px', border: '1px solid rgba(128,128,128,.28)', background: 'transparent', color: 'inherit', cursor: 'pointer' } },
          buckets.length ? h('span', { style: { display: 'grid', gap: '3px' } }, ...buckets.map((b, i) => h('span', { key: i }, remainingBar(b, true, quota.data?.stale, group.name + ' ' + windowName(b) + 'остаток квоты')))) : h('span', { 'aria-hidden': true }, quota.data?.status === 'error' ? '!' : quota.data ? '?' : '…')),
        control ? h('button', {
          type: 'button', title: warmupTitle, 'aria-label': 'Прогреть ACP', 'aria-busy': warming,
          disabled: Boolean(warming || working || ready), onClick: () => warmup.run('warmup'),
          style: { ...ACTION, padding: '4px 9px', minHeight: '26px', borderRadius: '99px', fontSize: '11px', whiteSpace: 'nowrap',
            color: ready ? '#25b879' : failed ? '#e5534b' : 'inherit', cursor: warming || working || ready ? 'default' : 'pointer' },
        }, warmupLabel) : null,
        expanded ? h('div', { role: 'dialog', 'aria-label': 'Квоты Antigravity', style: { position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, zIndex: 50, width: 'min(340px, calc(100vw - 48px))', maxHeight: 'min(75vh, calc(100vh - 72px))', overflowY: 'auto', boxSizing: 'border-box', overflowWrap: 'anywhere', padding: '16px', borderRadius: '16px', background: 'var(--dsh-surface, Canvas)', color: 'var(--dsh-text, CanvasText)', border: '1px solid rgba(128,128,128,.25)', boxShadow: '0 14px 40px rgba(0,0,0,.22)', fontSize: '12px', ...position } },
          QuotaDetails({ ...quota, model })) : null)
    }

    /** 给 promise 加超时：Host 侧异常时界面也要落到可读错误，而不是永远 pending。 */
    function withTimeout(promise, ms, message) {
      let timer
      return Promise.race([
        Promise.resolve(promise),
        new Promise((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error(message)), ms)
        }),
      ]).finally(() => clearTimeout(timer))
    }

    /** 组装额度读取器：remote.agyQuota 由 Host 注册后才出现，短轮询等待就绪。 */
    function makeQuotaReader(scope) {
      const listeners = new Set()
      const read = async (force) => {
        const deadline = Date.now() + 20_000
        for (;;) {
          // **只能用 `get()`**：`scope.remote.agyQuota` 这种属性访问在未 inject 的
          // 命名空间上会由 cordis 直接抛「cannot get property "remote.<ns>" without
          // inject」，而这正是本药丸的处境（贡献型 remote 由 $mount 挂载、不进 inject）。
          // 参考实现 dsh-subusage 同样是 `ctx.get("remote.subUsage")`。
          const service = scope.get('remote.agyQuota')
          if (service && typeof service.read === 'function') {
            // Host 侧会起官方 agy CLI 取数（其启动含登录刷新）。万一它挂在网络上，
            // 也要让药丸显示「读取失败 + 原因」，而不是一直停在「额度…」。
            return await withTimeout(
              service.read(force ? { force: true } : undefined),
              60_000,
              'таймаут чтения квоты (agy CLI на стороне Host не ответил за 60 секунд)',
            )
          }
          if (Date.now() >= deadline) {
            throw new Error('сервис квот не готов (на Host не смонтирован remote.agyQuota)')
          }
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }
      const reader = async (force) => {
        const value = unwrap(await read(force))
        for (const listener of listeners) listener(value)
        return value
      }
      reader.subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener) }
      return reader
    }

    function makeControlReader(scope) {
      return async (method, request) => {
        if (!['account', 'models'].includes(method)) throw new Error('неподдерживаемая операция настроек')
        const deadline = Date.now() + 20_000
        for (;;) {
          const service = scope.get('remote.agyQuota')
          if (typeof service?.[method] === 'function') {
            const pending = service[method](request)
            // 目录发现可能包含冷启动；各阶段超时由 Host 管理，客户端不另设更短的总期限。
            return method === 'models' ? await pending : await withTimeout(pending, 60_000, 'таймаут операции настроек, повторите попытку')
          }
          if (Date.now() >= deadline) throw new Error('сервис управления настройками не готов; проверьте совпадение версий Host и Client')
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }
    }

    /**
     * 客户端侧的额度 remote 声明。
     *
     * **贡献型 remote 必须在客户端显式挂载一次**（`ctx.remote.$mount(...)`），
     * `remote.agyQuota` 才会成为客户端可查的服务——同宿主上正常工作的
     * `dsh-subusage` 就是这么写的（`ctx.remote.$mount(subUsageRemote)` 之后再
     * `ctx.get("remote.subUsage")`）。只做 Host 侧注册而不挂载，客户端永远查不到服务。
     *
     * 声明必须与 Host 侧 `AGY_QUOTA_INVOCATIONS` 逐字段一致：id / service / namespace /
     * method / 参数与结果的 codec（客户端要按同一 codec 编解码）。
     */
    const AGY_QUOTA_PACKAGE = 'dsh-bundle-antigravity-host'
    const AGY_QUOTA_SERVICE = 'agyQuota'

    function strictCodec(typeSymbol, parse) {
      const schema = { parse }
      return { mode: 'strict', typeSymbol, create: () => schema }
    }

    function parseQuotaRequest(value) {
      if (value === undefined || value === null) return undefined
      if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid AgYQuotaRequest')
      if (value.force !== undefined && typeof value.force !== 'boolean') throw new TypeError('Invalid AgYQuotaRequest.force')
      return value
    }

    function parseQuotaResult(value) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError('Invalid AgYQuotaResult')
      if (value.status !== 'ok' && value.status !== 'error') throw new TypeError('Invalid AgYQuotaResult.status')
      if (!Array.isArray(value.groups)) throw new TypeError('Invalid AgYQuotaResult.groups')
      return value
    }

    const AGY_QUOTA_REMOTE = {
      package: AGY_QUOTA_PACKAGE,
      descriptors: [
        {
          id: `${AGY_QUOTA_PACKAGE}#${AGY_QUOTA_SERVICE}/read`,
          service: AGY_QUOTA_SERVICE,
          namespace: AGY_QUOTA_SERVICE,
          method: 'read',
          invocation: { kind: 'direct' },
          parameters: [
            {
              name: 'request',
              wire: 'request',
              source: 'json',
              acceptsUndefined: true,
              codec: strictCodec(`${AGY_QUOTA_PACKAGE}#AgYQuotaRequest`, parseQuotaRequest),
            },
          ],
          result: strictCodec(`${AGY_QUOTA_PACKAGE}#AgYQuotaResult`, parseQuotaResult),
        },
        ...['account', 'models'].map((method) => ({
          id: `${AGY_QUOTA_PACKAGE}#${AGY_QUOTA_SERVICE}/${method}`, service: AGY_QUOTA_SERVICE, namespace: AGY_QUOTA_SERVICE, method,
          invocation: { kind: 'direct' },
          parameters: [{ name: 'request', wire: 'request', source: 'json', acceptsUndefined: true,
            codec: method === 'models' ? strictCodec(`${AGY_QUOTA_PACKAGE}#AgYQuotaRequest`, parseQuotaRequest)
              : strictCodec(`${AGY_QUOTA_PACKAGE}#AgYAccountRequest`, (value) => {
                if (value === undefined) return { action: 'status' }
                if (!value || typeof value !== 'object' || !['status', 'login', 'warmup', 'cancel'].includes(value.action)) throw new TypeError('Invalid AgYAccountRequest')
                return value
              }) }],
          result: strictCodec(`${AGY_QUOTA_PACKAGE}#${method === 'models' ? 'AgYModelsResult' : 'AgYAccountResult'}`, (value) => {
            if (!value || typeof value !== 'object') throw new TypeError('Invalid settings result')
            if (method === 'models' ? !Array.isArray(value.models) || !['ok', 'error'].includes(value.status)
              : !['idle', 'connecting', 'cancelling', 'connected', 'cancelled', 'error'].includes(value.state) || typeof value.message !== 'string') throw new TypeError('Invalid settings result')
            return value
          }),
        })),
      ],
    }

    return {
      name: 'dsh-bundle-antigravity-host',
      // remote.settings / remote.llm 必须逐个声明：remote 各命名空间是独立服务，
      // 漏声明会在读取属性时抛「without inject」并击穿 settings.section 卡片。
      inject: ['slots', 'remote', 'remote.settings', 'remote.llm'],
      apply(ctx) {
        const readQuota = makeQuotaReader(ctx)
        const control = makeControlReader(ctx)
        // 挂载本包贡献的 remote（幂等，随 fiber 一起 dispose）。挂载失败不影响其它卡片：
        // 药丸会自行超时并显示「额度服务未就绪」的原因。
        try {
          const mounted = ctx.remote.$mount(AGY_QUOTA_REMOTE)
          ctx.effect(() => mounted, 'antigravity-acp: mount quota remote')
        } catch (error) {
          console.error('[dsh-bundle-antigravity-host] не удалось смонтировать клиентский remote квот:', error)
        }
        ctx.effect(
          () =>
            ctx.slots.inject('settings.section', () =>
              ctx.slots.register(
                {
                  name: 'settings.section',
                  id: 'antigravity-acp',
                  order: 42,
                  label: () => 'Antigravity ACP',
                  inject: () => ({ remote: ctx.remote, control }),
                },
                AntigravitySettingsCard,
              ),
            ),
          'antigravity-acp: settings section',
        )
        // 额度药丸：紧邻模型选择器左侧（宿主把 conversation.input.right 渲染在
        // conversation.input.model 之前）。modelDirectories 是会话模型目录服务。
        //
        // 注意：这里**不能**把 `remote.agyQuota` 写进 inject。贡献型 remote 的客户端
        // 服务要等 `ctx.remote.$mount(...)`（见 apply 里那段）完成后才存在，写进 inject
        // 会让整个注册回调一直等待 —— 表现为**药丸彻底消失**（2026-10-17 实测踩过）。
        // 正确做法是照常注册 slot，由读取器短轮询等服务出现。
        ctx.inject(['slots', 'modelDirectories'], (scope) => {
          // 读取器按 scope 建一次：药丸的取数 effect 依赖 readQuota 的身份，若每次
          // inject 都新建函数，身份变化会让 effect 反复重跑、重复触发 Host 侧 CLI 取数。
          scope.effect(
            () =>
              scope.slots.inject('conversation.input.right', () =>
                scope.slots.register(
                  {
                    name: 'conversation.input.right',
                    id: PILL_ID,
                    order: 1002,
                    inject: (sessionId) => ({
                      store: scope.modelDirectories.directoryFor(sessionId).store,
                      readQuota,
                      control,
                    }),
                  },
                  AgYQuotaPill,
                ),
              ),
            'antigravity-acp: quota pill',
          )
        })
      },
    }
  },
})
