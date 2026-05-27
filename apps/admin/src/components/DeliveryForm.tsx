import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { LocateFixed, MapPin, MapPinned, Phone, PlusCircle, Printer, Search, UserRound } from "lucide-react";
import { createDelivery, geocodeAddress, lookupCustomerByPhone, type CreatedDeliveryResult } from "../api";
import { apiDeadlineTierFromDeliveryDeadlineTier, mapDeliveryDeadlineTier, mapDeliveryPriority, mapDeliveryStatus } from "../apiMappers";
import { buildAttendantReferenceOptions } from "../attendantReferences";
import { hasEnoughDeliveryPhoneDigits, normalizeDeliveryPhoneInput } from "../deliveryPhone";
import {
  buildDeliveryNotesWithPayment,
  formatBrazilianMoneyInput,
  type CashChangeMode,
  type DeliveryPaymentMethod,
} from "../deliveryPaymentNotes";
import { buildDeliveryScheduleSuggestion, type DeliveryScheduleMode } from "../deliverySchedule";
import { userFacingError } from "../userMessages";
import { MapPicker } from "./MapPicker";
import { printThermalReceipt } from "../thermalReceipt";
import type { CustomerAddress, CustomerLookup, Delivery, DeliveryDeadlineTier, GeocodeResult, StoreUnit, TeamUser } from "../types";

type DeliveryFormProps = {
  stores: StoreUnit[];
  redirectStores?: StoreUnit[];
  attendants?: TeamUser[];
  onCreated?: () => void;
};

type FormState = {
  phone: string;
  customerName: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  latitude: string;
  longitude: string;
  scheduleMode: DeliveryScheduleMode;
  earliestDispatchAt: string;
  deadlineTier: DeliveryDeadlineTier;
  orderValue: string;
  paymentMethod: DeliveryPaymentMethod;
  cashChangeMode: CashChangeMode;
  cashChangeFor: string;
  attendantName: string;
  storeName: string;
  redirectTo: string;
  notes: string;
};

type DeliveryFormSection = "cliente" | "endereco" | "entrega" | "impressao";

const initialForm: FormState = {
  phone: "",
  customerName: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  latitude: "",
  longitude: "",
  scheduleMode: "agora",
  earliestDispatchAt: "",
  deadlineTier: "Medio",
  orderValue: "",
  paymentMethod: "CARTAO",
  cashChangeMode: "SEM_TROCO",
  cashChangeFor: "",
  attendantName: "",
  storeName: "",
  redirectTo: "Manter loja origem",
  notes: "",
};

const printAfterCreateStorageKey = "farmadelivery.printAfterCreate";

export function DeliveryForm({ stores, redirectStores = stores, attendants = [], onCreated }: DeliveryFormProps) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [activeSection, setActiveSection] = useState<DeliveryFormSection>("cliente");
  const [customerLookup, setCustomerLookup] = useState<CustomerLookup | null>(null);
  const [geocodeOptions, setGeocodeOptions] = useState<GeocodeResult[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "found" | "empty" | "error">("idle");
  const [geocodeState, setGeocodeState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [submitState, setSubmitState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [printAfterCreate, setPrintAfterCreate] = useState(() => readPrintAfterCreatePreference());
  const [scheduleEdited, setScheduleEdited] = useState(false);
  const [feedback, setFeedback] = useState<string>("");
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Garante que o storeName sempre reflita a loja disponivel quando o form nao tem valor
  // (ex: primeiro render, apos reset ou quando a loja muda por ser usuario de loja unica)
  useEffect(() => {
    if (!form.storeName && stores[0]?.name) {
      setForm((current) => ({ ...current, storeName: stores[0].name }));
    }
  }, [stores, form.storeName]);

  const selectedStore = useMemo(
    () => stores.find((store) => store.name === form.storeName) ?? stores[0],
    [form.storeName, stores],
  );
  const redirectStore = useMemo(
    () => redirectStores.find((store) => store.name === form.redirectTo),
    [form.redirectTo, redirectStores],
  );
  const attendantOptions = useMemo(
    () => buildAttendantReferenceOptions(attendants),
    [attendants],
  );

  const canSubmit = Boolean(
    selectedStore?.id && hasEnoughDeliveryPhoneDigits(form.phone) && form.customerName.trim() && form.street.trim() && form.number.trim(),
  );
  const formBusy = submitState === "loading" || geocodeState === "loading";
  const parsedCoordinates = parseCoordinates(form.latitude, form.longitude);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitDelivery({ skipGeocode: false });
  }

  async function submitDelivery({ skipGeocode }: { skipGeocode: boolean }) {
    const selectedStoreId = selectedStore?.id;
    if (!selectedStoreId || !canSubmit) {
      const missing = [];
      if (!hasEnoughDeliveryPhoneDigits(form.phone)) missing.push("telefone");
      if (!form.customerName.trim()) missing.push("nome do cliente");
      if (!form.street.trim()) missing.push("endereco");
      if (!form.number.trim()) missing.push("numero");
      if (!selectedStoreId) missing.push("loja de origem");

      setSubmitState("error");
      setFeedback(`Preencha os campos obrigatorios: ${missing.join(", ")}.`);
      return;
    }

    setSubmitState("loading");
    setFeedback("");

    try {
      const deliveryCoordinates = skipGeocode ? parsedCoordinates ?? undefined : await resolveCoordinatesForSubmit();
      const normalizedPhone = normalizeDeliveryPhoneInput(form.phone);
      const result = await createDelivery({
        storeId: selectedStoreId,
        redirectStoreId: redirectStore?.id && redirectStore.id !== selectedStoreId ? redirectStore.id : undefined,
        customerAddressId: customerLookup?.addresses.some((address) => address.id === selectedAddressId)
          ? selectedAddressId
          : undefined,
        attendantName: form.attendantName.trim() || undefined,
        customerName: form.customerName.trim(),
        phone: normalizedPhone.trim(),
        street: form.street.trim(),
        number: form.number.trim(),
        complement: form.complement.trim() || undefined,
        neighborhood: form.neighborhood.trim() || undefined,
        coordinates: deliveryCoordinates,
        priority: "NORMAL",
        deadlineTier: apiDeadlineTierFromDeliveryDeadlineTier(form.deadlineTier),
        notes: buildDeliveryNotesWithPayment({
          amount: form.orderValue,
          paymentMethod: form.paymentMethod,
          cashChangeMode: form.cashChangeMode,
          cashChangeFor: form.cashChangeFor,
          notes: form.notes,
        }),
        earliestDispatchAt:
          form.scheduleMode === "agora" || !form.earliestDispatchAt
            ? undefined
            : new Date(form.earliestDispatchAt).toISOString(),
      });

      setSubmitState("success");
      let successFeedback = `Entrega ${result.publicCode} criada com hora automatica.`;
      if (!deliveryCoordinates) {
        successFeedback += " Ela ficou sem ponto no mapa ate o endereco ser conferido.";
      }
      if (printAfterCreate) {
        const printed = printThermalReceipt(createdDeliveryToReceiptDelivery(result));
        if (!printed) {
          successFeedback += " O navegador bloqueou a janela de impressao; libere pop-ups para imprimir automaticamente.";
        }
      }
      setFeedback(successFeedback);
      onCreated?.();
      setForm({
        ...initialForm,
        storeName: selectedStore.name,
      });
      setCustomerLookup(null);
      setGeocodeOptions([]);
      setSelectedAddressId("");
      setLookupState("idle");
      setGeocodeState("idle");
      setScheduleEdited(false);
    } catch (error) {
      console.error("delivery create error", error);
      setSubmitState("error");
      setFeedback(userFacingError(error, "Nao foi possivel criar a entrega agora. Confira os dados e tente novamente."));
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    const nextValue = key === "phone" ? normalizeDeliveryPhoneInput(String(value)) : value;
    if (key === "orderValue" || key === "cashChangeFor") {
      setForm((current) => ({ ...current, [key]: formatBrazilianMoneyInput(String(value)) }));
      return;
    }
    if (key === "phone") {
      setCustomerLookup(null);
      setSelectedAddressId("");
      setLookupState("idle");
    }
    if (["street", "number", "complement", "neighborhood", "latitude", "longitude"].includes(key)) {
      setSelectedAddressId("");
    }
    if (["street", "number", "neighborhood"].includes(key)) {
      setGeocodeOptions([]);
      setGeocodeState("idle");
    }
    if (key === "earliestDispatchAt") {
      setScheduleEdited(true);
    }
    if (key === "scheduleMode") {
      const scheduleMode = nextValue as DeliveryScheduleMode;
      setScheduleEdited(false);
      setForm((current) => ({
        ...current,
        scheduleMode,
        earliestDispatchAt:
          scheduleMode === "agora"
            ? ""
            : current.scheduleMode === scheduleMode && current.earliestDispatchAt
              ? current.earliestDispatchAt
              : buildDeliveryScheduleSuggestion(scheduleMode, new Date(), selectedStore?.weeklyHours),
      }));
      return;
    }
    if (key === "storeName") {
      const nextStore = stores.find((store) => store.name === nextValue);
      setForm((current) => ({
        ...current,
        storeName: String(nextValue),
        earliestDispatchAt:
          current.scheduleMode !== "agora" && !scheduleEdited
            ? buildDeliveryScheduleSuggestion(current.scheduleMode, new Date(), nextStore?.weeklyHours)
            : current.earliestDispatchAt,
      }));
      return;
    }

    setForm((current) => ({ ...current, [key]: nextValue }));
  }

  async function handleLookupCustomer() {
    const normalizedPhone = normalizeDeliveryPhoneInput(form.phone);
    if (!hasEnoughDeliveryPhoneDigits(normalizedPhone)) {
      setLookupState("error");
      setFeedback("Informe o telefone antes de buscar o cliente.");
      setForm((current) => ({ ...current, phone: normalizedPhone }));
      return;
    }

    setLookupState("loading");
    setFeedback("");

    try {
      setForm((current) => ({ ...current, phone: normalizedPhone }));
      const customer = await lookupCustomerByPhone(normalizedPhone);
      setCustomerLookup(customer);
      if (!customer) {
        setLookupState("empty");
        setFeedback("Cliente ainda nao cadastrado para este telefone.");
        return;
      }

      setLookupState("found");
      setFeedback(`${customer.name} encontrado com ${customer.addresses.length} endereco(s).`);
      setForm((current) => ({ ...current, customerName: customer.name }));
      if (customer.addresses[0]) {
        applyAddress(customer.addresses[0]);
      }
    } catch (error) {
      console.error("customer lookup error", error);
      setLookupState("error");
      setCustomerLookup(null);
      setFeedback(userFacingError(error, "Nao foi possivel buscar o cliente agora."));
    }
  }

  async function handleGeocodeAddress() {
    return resolveCoordinatesForCurrentAddress({ manual: true });
  }

  async function resolveCoordinatesForSubmit() {
    if (parsedCoordinates) return parsedCoordinates;
    try {
      const result = await resolveCoordinatesForCurrentAddress({ manual: false });
      return {
        latitude: result.latitude,
        longitude: result.longitude,
      };
    } catch (error) {
      const message = userFacingError(error, "Nao foi possivel localizar esse endereco agora.");
      throw new Error(`${message} Confira o endereco ou lance sem ponto no mapa para nao parar o atendimento.`);
    }
  }

  async function resolveCoordinatesForCurrentAddress({ manual }: { manual: boolean }) {
    if (!form.street.trim() || !form.number.trim()) {
      setGeocodeState("error");
      setFeedback("Preencha endereco e numero antes de buscar coordenadas.");
      throw new Error("Preencha endereco e numero antes de buscar coordenadas.");
    }

    setGeocodeState("loading");
    setFeedback(manual ? "" : "Localizando endereco para colocar a entrega no mapa...");

    try {
      const result = await geocodeAddress({
        street: form.street.trim(),
        number: form.number.trim(),
        neighborhood: form.neighborhood.trim() || undefined,
      });
      const options = [result, ...(result.alternatives ?? []).map((alternative) => ({ ...alternative, query: result.query }))];
      setGeocodeOptions(options);
      applyGeocodeResult(result);
      setSelectedAddressId("");
      setGeocodeState("success");
      setFeedback(manual ? `Endereco localizado: ${result.label}` : "Endereco localizado. Lancando entrega...");
      return result;
    } catch (error) {
      console.error("geocode error", error);
      setGeocodeState("error");
      const message = userFacingError(error, "Nao foi possivel localizar esse endereco agora.");
      setFeedback(message);
      throw new Error(message);
    }
  }

  function applyGeocodeResult(result: GeocodeResult) {
    setForm((current) => ({
      ...current,
      latitude: String(result.latitude),
      longitude: String(result.longitude),
    }));
  }

  function applyAddress(address: CustomerAddress) {
    setSelectedAddressId(address.id);
    setForm((current) => ({
      ...current,
      street: address.street,
      number: address.number,
      complement: address.complement ?? "",
      neighborhood: address.neighborhood ?? "",
      latitude: address.latitude === null || address.latitude === undefined ? "" : String(address.latitude),
      longitude: address.longitude === null || address.longitude === undefined ? "" : String(address.longitude),
    }));
  }

  function startNewAddressForCustomer() {
    setSelectedAddressId("");
    setGeocodeOptions([]);
    setGeocodeState("idle");
    setForm((current) => ({
      ...current,
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      latitude: "",
      longitude: "",
    }));
    setActiveSection("endereco");
    setFeedback("Preencha o novo endereco; ele ficara salvo neste telefone.");
  }

  return (
    <section className="deliveryForm" aria-label="Criar entrega">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Balcao e caixa</span>
          <h2>Criar entrega</h2>
        </div>
        <button className="ghostIcon" type="button" aria-label="Buscar cliente" disabled={formBusy} onClick={handleLookupCustomer}>
          <Search size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="sectionTabs" aria-label="Etapas do cadastro de entrega">
          <button className={activeSection === "cliente" ? "selected" : ""} type="button" onClick={() => setActiveSection("cliente")}>
            Cliente
          </button>
          <button className={activeSection === "endereco" ? "selected" : ""} type="button" onClick={() => setActiveSection("endereco")}>
            Endereco
          </button>
          <button className={activeSection === "entrega" ? "selected" : ""} type="button" onClick={() => setActiveSection("entrega")}>
            Entrega
          </button>
          <button className={activeSection === "impressao" ? "selected" : ""} type="button" onClick={() => setActiveSection("impressao")}>
            Impressao
          </button>
        </div>

        <div className="formGrid">
          {activeSection === "cliente" ? (
            <>
              <Field
                label="Telefone"
                icon={<Phone size={16} />}
                value={form.phone}
                disabled={formBusy}
                inputMode="tel"
                onChange={(value) => update("phone", value)}
              />
              <Field
                label="Nome"
                icon={<UserRound size={16} />}
                value={form.customerName}
                disabled={formBusy}
                onChange={(value) => update("customerName", value)}
              />
              {customerLookup ? (
                <div className="customerLookupCard wideHint">
                  <div>
                    <strong>Cliente encontrado</strong>
                    <span>
                      {customerLookup.name} - {customerLookup.phone}
                    </span>
                  </div>
                  {customerLookup.addresses.length ? (
                    <label className="inputGroup">
                      <span>Enderecos salvos</span>
                      <select
                        value={selectedAddressId}
                        disabled={formBusy}
                        onChange={(event) => {
                          if (!event.target.value) {
                            startNewAddressForCustomer();
                            return;
                          }
                          const address = customerLookup.addresses.find((item) => item.id === event.target.value);
                          if (address) {
                            applyAddress(address);
                            setActiveSection("endereco");
                          }
                        }}
                      >
                        {customerLookup.addresses.map((address) => (
                          <option key={address.id} value={address.id}>
                            {formatAddressOption(address)}
                          </option>
                        ))}
                        <option value="">Novo endereco para este cliente</option>
                      </select>
                    </label>
                  ) : (
                    <div className="fieldHint">Cliente encontrado, mas sem endereco salvo.</div>
                  )}
                  <button className="secondaryButton" type="button" disabled={formBusy} onClick={startNewAddressForCustomer}>
                    <PlusCircle size={16} />
                    Novo endereco para este cliente
                  </button>
                </div>
              ) : lookupState === "found" ? (
                <div className="fieldHint wideHint">Cliente encontrado, mas sem endereco salvo. Preencha um novo endereco.</div>
              ) : null}
            </>
          ) : null}

          {activeSection === "endereco" ? (
            <>
              <Field
                label="Endereco"
                icon={<MapPin size={16} />}
                value={form.street}
                disabled={formBusy}
                onChange={(value) => update("street", value)}
                wide
              />
              <Field label="Numero" value={form.number} disabled={formBusy} onChange={(value) => update("number", value)} />
              <Field
                label="Apt / casa / referencia"
                value={form.complement}
                disabled={formBusy}
                onChange={(value) => update("complement", value)}
              />
              <Field label="Bairro" value={form.neighborhood} disabled={formBusy} onChange={(value) => update("neighborhood", value)} />
              {selectedAddressId ? (
                <div className="fieldHint wideHint">Usando endereco salvo deste cliente. Qualquer alteracao aqui vira um novo endereco.</div>
              ) : customerLookup ? (
                <div className="fieldHint wideHint">Novo endereco para este cliente. Ao lancar, ele ficara disponivel nas proximas entregas.</div>
              ) : null}
              <div className="geocodeActions">
                <button
                  className="secondaryButton"
                  type="button"
                  onClick={handleGeocodeAddress}
                  disabled={!form.street.trim() || !form.number.trim() || geocodeState === "loading"}
                >
                  <LocateFixed size={16} />
                  {geocodeState === "loading" ? "Localizando..." : parsedCoordinates ? "Localizacao pronta" : "Localizar endereco"}
                </button>
                <button
                  className="secondaryButton"
                  type="button"
                  onClick={() => setShowMapPicker(true)}
                  disabled={formBusy}
                  title="Ajustar ponto manualmente no mapa"
                >
                  <MapPinned size={16} />
                  {parsedCoordinates ? "Ajustar no mapa" : "Definir no mapa"}
                </button>
                <span>{parsedCoordinates ? "A entrega entrara no mapa e na rota." : "Localize automaticamente ou clique em Definir no mapa para posicionar manualmente."}</span>
              </div>
              {geocodeOptions.length ? (
                <div className="geocodeOptions">
                  {geocodeOptions.map((option) => (
                    <button
                      key={`${option.latitude}-${option.longitude}-${option.label}`}
                      type="button"
                      disabled={formBusy}
                      onClick={() => applyGeocodeResult(option)}
                    >
                      <strong>{formatCoordinate(option.latitude, option.longitude)}</strong>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          {activeSection === "entrega" ? (
            <>
              <label className="inputGroup">
                <span>Prazo manual</span>
                <select
                  value={form.deadlineTier}
                  disabled={formBusy}
                  onChange={(event) => update("deadlineTier", event.target.value as DeliveryDeadlineTier)}
                >
                  <option value="Perto">Perto - 60 a 90 min</option>
                  <option value="Medio">Medio - 90 a 120 min</option>
                  <option value="Longe">Longe - 120 a 180 min</option>
                </select>
              </label>
              <label className="inputGroup">
                <span>Atendente</span>
                <input
                  className="plainInput"
                  list="delivery-attendants"
                  value={form.attendantName}
                  disabled={formBusy}
                  placeholder="Codigo ou nome de quem conferiu"
                  onChange={(event) => update("attendantName", event.target.value)}
                />
                <datalist id="delivery-attendants">
                  {attendantOptions.map((option) => (
                    <option key={option.value} value={option.value} label={option.label} />
                  ))}
                </datalist>
                <small className="inputHint">Use o cadastro de funcionarios de conferencia para preencher mais rapido.</small>
              </label>
              <label className="inputGroup">
                <span>Agendamento</span>
                <select
                  value={form.scheduleMode}
                  disabled={formBusy}
                  onChange={(event) => update("scheduleMode", event.target.value as FormState["scheduleMode"])}
                >
                  <option value="agora">Agora</option>
                  <option value="hoje">Hoje com horario</option>
                  <option value="futuro">Amanha / data futura</option>
                </select>
              </label>
              <label className="inputGroup">
                <span>A partir de</span>
                <input
                  className="plainInput"
                  type="datetime-local"
                  disabled={form.scheduleMode === "agora" || formBusy}
                  value={form.earliestDispatchAt}
                  onChange={(event) => update("earliestDispatchAt", event.target.value)}
                />
              </label>
              <label className="inputGroup">
                <span>Pagamento</span>
                <select
                  value={form.paymentMethod}
                  disabled={formBusy}
                  onChange={(event) => update("paymentMethod", event.target.value as DeliveryPaymentMethod)}
                >
                  <option value="CARTAO">Cartao</option>
                  <option value="QRCODE">QR Code</option>
                  <option value="PIX_PAGO">Pix pago</option>
                  <option value="DINHEIRO">Dinheiro</option>
                  <option value="CONTA">Conta</option>
                </select>
              </label>
              <label className="inputGroup">
                <span>Valor</span>
                <input
                  className="plainInput"
                  value={form.orderValue}
                  disabled={formBusy}
                  inputMode="decimal"
                  placeholder="R$ 0,00"
                  onChange={(event) => update("orderValue", event.target.value)}
                />
              </label>
              {form.paymentMethod === "DINHEIRO" ? (
                <>
                  <label className="inputGroup">
                    <span>Troco</span>
                    <select
                      value={form.cashChangeMode}
                      disabled={formBusy}
                      onChange={(event) => update("cashChangeMode", event.target.value as CashChangeMode)}
                    >
                      <option value="SEM_TROCO">Sem troco</option>
                      <option value="COM_TROCO">Precisa troco</option>
                    </select>
                  </label>
                  <label className="inputGroup">
                    <span>Troco para</span>
                    <input
                      className="plainInput"
                      value={form.cashChangeFor}
                      disabled={formBusy || form.cashChangeMode !== "COM_TROCO"}
                      inputMode="decimal"
                      placeholder="Ex.: R$ 100,00"
                      onChange={(event) => update("cashChangeFor", event.target.value)}
                    />
                  </label>
                </>
              ) : null}
              <label className="inputGroup">
                <span>Loja origem</span>
                <select
                  value={form.storeName || (stores[0]?.name ?? "")}
                  disabled={formBusy}
                  onChange={(event) => update("storeName", event.target.value)}
                >
                  {stores.map((store) => (
                    <option key={store.name}>{store.name}</option>
                  ))}
                </select>
              </label>
              <label className="inputGroup">
                <span>Redirecionar para</span>
                <select value={form.redirectTo} disabled={formBusy} onChange={(event) => update("redirectTo", event.target.value)}>
                  <option>Manter loja origem</option>
                  {redirectStores.map((store) => (
                    <option key={store.name}>{store.name}</option>
                  ))}
                </select>
              </label>
              <label className="inputGroup wide">
                <span>Observacoes</span>
                <textarea
                  value={form.notes}
                  disabled={formBusy}
                  onChange={(event) => update("notes", event.target.value)}
                  placeholder="Ex.: cliente pediu ligar ao chegar, portao azul, pagamento na entrega"
                />
              </label>
            </>
          ) : null}

          {activeSection === "impressao" ? (
            <>
              <label className="checkLine wide">
                <input
                  type="checkbox"
                  checked={printAfterCreate}
                  disabled={formBusy}
                  onChange={(event) => updatePrintAfterCreatePreference(event.target.checked, setPrintAfterCreate)}
                />
                <Printer size={16} />
                Imprimir comanda apos lancar
              </label>
              <div className="fieldHint wideHint">Comanda fixa em 80mm para economizar papel e manter o corte seguro.</div>
            </>
          ) : null}
        </div>

        {feedback ? <div className={`formFeedback ${submitState}`}>{feedback}</div> : null}

        <div className="formActions">
          <button className="primaryButton" type="submit" disabled={submitState === "loading" || geocodeState === "loading"}>
            {submitState === "loading" || geocodeState === "loading" ? "Lancando..." : "Lancar entrega"}
          </button>
          {geocodeState === "error" ? (
            <button
              className="secondaryButton"
              type="button"
              disabled={submitState === "loading"}
              onClick={() => void submitDelivery({ skipGeocode: true })}
            >
              Lancar sem mapa
            </button>
          ) : null}
        </div>
      </form>

      {showMapPicker ? (
        <MapPicker
          latitude={parsedCoordinates?.latitude}
          longitude={parsedCoordinates?.longitude}
          label={[form.street, form.number, form.neighborhood].filter(Boolean).join(", ") || undefined}
          onConfirm={(lat, lng) => {
            setForm((current) => ({
              ...current,
              latitude: String(lat),
              longitude: String(lng),
            }));
            setSelectedAddressId("");
            setGeocodeState("success");
            setFeedback("Coordenadas selecionadas no mapa.");
            setShowMapPicker(false);
          }}
          onClose={() => setShowMapPicker(false)}
        />
      ) : null}
    </section>
  );
}

function formatAddressOption(address: CustomerAddress) {
  return [address.street, address.number, address.complement, address.neighborhood].filter(Boolean).join(", ");
}

/** Le a preferencia local da maquina para imprimir automaticamente apos criar entrega. */
function readPrintAfterCreatePreference() {
  try {
    return localStorage.getItem(printAfterCreateStorageKey) === "true";
  } catch {
    return false;
  }
}

/** Salva a preferencia local de impressao automatica sem depender do banco. */
function updatePrintAfterCreatePreference(value: boolean, setValue: (value: boolean) => void) {
  setValue(value);
  try {
    localStorage.setItem(printAfterCreateStorageKey, String(value));
  } catch {
    // Preferencia local e opcional; falha de storage nao deve bloquear criacao de entrega.
  }
}

/** Converte o retorno real da API em dados suficientes para a comanda termica. */
function createdDeliveryToReceiptDelivery(result: CreatedDeliveryResult): Delivery {
  return {
    id: result.id,
    publicCode: result.publicCode,
    storeDailyDate: result.storeDailyDate ?? null,
    storeDailyNumber: result.storeDailyNumber ?? null,
    store: result.store.name,
    customer: result.customer.name,
    phone: result.customer.phone,
    address: [result.address.street, result.address.number, result.address.complement].filter(Boolean).join(", "),
    status: mapDeliveryStatus(result.status),
    courier: "Sem motoboy",
    createdAt: formatDateTime(result.createdAt),
    rawCreatedAt: result.createdAt,
    rawScheduledFor: result.earliestDispatchAt ?? undefined,
    scheduledFor: result.earliestDispatchAt ? formatDateTime(result.earliestDispatchAt) : "Agora",
    priority: mapDeliveryPriority(result.priority),
    deadlineTier: mapDeliveryDeadlineTier(result.deadlineTier ?? "MEDIO"),
    distanceHint: "Aguardando rota",
    notes: result.notes ?? null,
    proofCount: 0,
  };
}

function Field({
  label,
  icon,
  value,
  wide,
  placeholder,
  disabled,
  inputMode,
  onChange,
}: {
  label: string;
  icon?: ReactNode;
  value: string;
  wide?: boolean;
  placeholder?: string;
  disabled?: boolean;
  inputMode?: "text" | "tel" | "numeric";
  onChange: (value: string) => void;
}) {
  return (
    <label className={`inputGroup ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      <div className="inputWithIcon">
        {icon}
        <input value={value} disabled={disabled} inputMode={inputMode} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      </div>
    </label>
  );
}

function parseCoordinates(latitude: string, longitude: string) {
  if (!latitude.trim() && !longitude.trim()) return null;
  if (!latitude.trim() || !longitude.trim()) return null;
  const lat = Number(latitude.replace(",", "."));
  const lng = Number(longitude.replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {
    latitude: lat,
    longitude: lng,
  };
}

function formatCoordinate(latitude: number, longitude: number) {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

/** Formata horarios da API na mesma leitura curta usada no restante do painel. */
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
