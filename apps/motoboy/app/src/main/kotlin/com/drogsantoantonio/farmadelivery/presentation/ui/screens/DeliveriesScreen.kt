package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import com.drogsantoantonio.farmadelivery.data.models.AuthSession
import com.drogsantoantonio.farmadelivery.data.models.DeliveryDto
import com.drogsantoantonio.farmadelivery.data.models.DeliveryEventDto
import com.drogsantoantonio.farmadelivery.data.repository.DeliveryRepository
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream
import java.io.File
import java.time.Instant
import kotlin.math.max

private enum class DeliveryListSection {
  Available,
  Active,
}

@Composable
fun DeliveriesScreen(
  session: AuthSession,
  deliveryRepository: DeliveryRepository,
  available: Boolean,
  onAvailabilityChanged: (Boolean) -> Unit,
  onLogout: () -> Unit,
) {
  val scope = rememberCoroutineScope()
  var deliveries by remember { mutableStateOf<List<DeliveryDto>>(emptyList()) }
  var loading by remember { mutableStateOf(true) }
  var error by remember { mutableStateOf<String?>(null) }
  var selectedSection by remember { mutableStateOf(DeliveryListSection.Available) }
  var lastSyncedAt by remember { mutableStateOf<Instant?>(null) }

  fun refresh() {
    scope.launch {
      loading = true
      error = null
      try {
        deliveries = deliveryRepository.list()
        lastSyncedAt = Instant.now()
      } catch (failure: Exception) {
        error = failure.message ?: "Nao foi possivel carregar entregas."
      } finally {
        loading = false
      }
    }
  }

  LaunchedEffect(Unit) {
    refresh()
  }

  Surface {
    Column(
      modifier = Modifier
        .fillMaxSize()
        .padding(16.dp),
    ) {
      Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
        Column {
          Text("Entregas", style = MaterialTheme.typography.headlineSmall)
          Text(session.name, style = MaterialTheme.typography.bodyMedium)
          Text(
            lastSyncLabel(lastSyncedAt),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
          )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          OutlinedButton(enabled = !loading, onClick = { refresh() }) {
            Text("Atualizar")
          }
          OutlinedButton(onClick = onLogout) {
            Text("Sair")
          }
        }
      }

      Spacer(Modifier.height(16.dp))

      when {
        loading -> LoadingState("Carregando entregas...")
        error != null -> ErrorState(
          message = error ?: "Nao foi possivel carregar entregas.",
          onRetry = { refresh() },
        )
        deliveries.isEmpty() -> EmptyState(
          message = "Nenhuma entrega disponivel agora.",
          onRefresh = { refresh() },
        )
        else -> {
          val sections = deliverySections(deliveries)
          Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            DeliverySectionTabs(
              selectedSection = selectedSection,
              availableCount = sections.available.size,
              activeCount = sections.active.size,
              onSelected = { selectedSection = it },
            )

            when (selectedSection) {
              DeliveryListSection.Available -> DeliverySectionList(
                title = "Entregas disponiveis",
                emptyMessage = "Nenhuma entrega disponivel agora.",
                deliveries = sections.available,
                courierId = session.courier?.id,
                available = available,
                onAvailabilityChanged = onAvailabilityChanged,
                onAccepted = { refresh() },
                repository = deliveryRepository,
              )

              DeliveryListSection.Active -> DeliverySectionList(
                title = "Minhas entregas",
                emptyMessage = "Voce ainda nao tem entregas em atendimento.",
                deliveries = sections.active,
                courierId = session.courier?.id,
                available = available,
                onAvailabilityChanged = onAvailabilityChanged,
                onAccepted = { refresh() },
                repository = deliveryRepository,
              )
            }
          }
        }
      }
    }
  }
}

@Composable
private fun DeliverySectionTabs(
  selectedSection: DeliveryListSection,
  availableCount: Int,
  activeCount: Int,
  onSelected: (DeliveryListSection) -> Unit,
) {
  Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
    if (selectedSection == DeliveryListSection.Available) {
      Button(modifier = Modifier.weight(1f), onClick = { onSelected(DeliveryListSection.Available) }) {
        Text("Disponiveis ($availableCount)")
      }
    } else {
      OutlinedButton(modifier = Modifier.weight(1f), onClick = { onSelected(DeliveryListSection.Available) }) {
        Text("Disponiveis ($availableCount)")
      }
    }

    if (selectedSection == DeliveryListSection.Active) {
      Button(modifier = Modifier.weight(1f), onClick = { onSelected(DeliveryListSection.Active) }) {
        Text("Minhas ($activeCount)")
      }
    } else {
      OutlinedButton(modifier = Modifier.weight(1f), onClick = { onSelected(DeliveryListSection.Active) }) {
        Text("Minhas ($activeCount)")
      }
    }
  }
}

@Composable
private fun DeliverySectionList(
  title: String,
  emptyMessage: String,
  deliveries: List<DeliveryDto>,
  courierId: String?,
  available: Boolean,
  onAvailabilityChanged: (Boolean) -> Unit,
  repository: DeliveryRepository,
  onAccepted: () -> Unit,
) {
  if (deliveries.isEmpty()) {
    EmptyState(message = emptyMessage, onRefresh = onAccepted)
    return
  }

  LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    item {
      Text(title, style = MaterialTheme.typography.titleMedium)
    }
    items(deliveries, key = { it.id }) { delivery ->
      DeliveryCard(
        delivery = delivery,
        courierId = courierId,
        available = available,
        onAvailabilityChanged = onAvailabilityChanged,
        onAccepted = onAccepted,
        repository = repository,
      )
    }
  }
}

@Composable
private fun LoadingState(message: String) {
  Column(
    verticalArrangement = Arrangement.spacedBy(10.dp),
    modifier = Modifier.fillMaxWidth(),
  ) {
    CircularProgressIndicator()
    Text(message, style = MaterialTheme.typography.bodyMedium)
  }
}

@Composable
private fun ErrorState(message: String, onRetry: () -> Unit) {
  Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    Text(message, color = MaterialTheme.colorScheme.error)
    OutlinedButton(onClick = onRetry) {
      Text("Tentar novamente")
    }
  }
}

@Composable
private fun EmptyState(message: String, onRefresh: () -> Unit) {
  Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    Text(message, style = MaterialTheme.typography.bodyMedium)
    OutlinedButton(onClick = onRefresh) {
      Text("Atualizar")
    }
  }
}

@Composable
private fun DeliveryCard(
  delivery: DeliveryDto,
  courierId: String?,
  available: Boolean,
  onAvailabilityChanged: (Boolean) -> Unit,
  repository: DeliveryRepository,
  onAccepted: () -> Unit,
) {
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  var actionError by remember { mutableStateOf<String?>(null) }
  var submitting by remember { mutableStateOf(false) }
  var problemNotes by remember { mutableStateOf("") }
  var showProblemForm by remember { mutableStateOf(false) }
  var deliveryNotes by remember { mutableStateOf("") }
  var showDeliveryForm by remember { mutableStateOf(false) }
  var showHistory by remember { mutableStateOf(false) }
  var historyLoading by remember { mutableStateOf(false) }
  var historyError by remember { mutableStateOf<String?>(null) }
  var historyLoaded by remember { mutableStateOf(false) }
  var events by remember { mutableStateOf<List<DeliveryEventDto>>(emptyList()) }
  var proofPhotoUri by remember { mutableStateOf<Uri?>(null) }
  var proofPhotoName by remember { mutableStateOf<String?>(null) }
  var proofReady by remember { mutableStateOf(false) }
  val acceptingCourierId = courierId?.takeIf { delivery.status == "AGUARDANDO_MOTOBOY" }
  val canAccept = acceptingCourierId != null && available
  val primaryAction = lifecyclePrimaryAction(delivery.status)
  val proofCameraLauncher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { saved ->
    proofReady = saved
    if (!saved) {
      proofPhotoUri = null
      proofPhotoName = null
    }
  }

  fun loadHistory() {
    if (historyLoading || historyLoaded) return
    scope.launch {
      historyLoading = true
      historyError = null
      try {
        events = repository.events(delivery.id)
        historyLoaded = true
      } catch (failure: Exception) {
        historyError = failure.message ?: "Nao foi possivel carregar o historico."
      } finally {
        historyLoading = false
      }
    }
  }

  fun markHistoryStale() {
    historyLoaded = false
    historyError = null
    events = emptyList()
  }
  val mapUri = remember(delivery.address, delivery.coordinates) { deliveryMapUri(delivery) }

  Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
     Column(Modifier.padding(14.dp)) {
     Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
       Column {
         Text(deliveryPrimaryCodeLabel(delivery.publicCode, delivery.storeDailyNumber), style = MaterialTheme.typography.titleMedium)
         if (deliveryDailyNumberLabel(delivery.storeDailyNumber) != null) {
           Text(delivery.publicCode, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
         }
       }
     Text(deliveryPriorityLabel(delivery.priority), color = MaterialTheme.colorScheme.secondary)
     }
      Text(delivery.customer, style = MaterialTheme.typography.bodyLarge)
      Text(delivery.phone, style = MaterialTheme.typography.bodySmall)
      Text(delivery.address, style = MaterialTheme.typography.bodyMedium)
      Text("${delivery.store} - ${deliveryStatusLabel(delivery.status)}", style = MaterialTheme.typography.bodySmall)
      Text(deliveryCardDateLabel(delivery.earliestDispatchAt ?: delivery.createdAt), style = MaterialTheme.typography.bodySmall)

      Spacer(Modifier.height(8.dp))
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(
          onClick = {
            actionError = null
            try {
              context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse(phoneDialUriString(delivery.phone))))
            } catch (_: ActivityNotFoundException) {
              actionError = "Nao foi possivel abrir o telefone neste aparelho."
            }
          },
        ) {
          Text("Ligar")
        }
        if (mapUri != null) {
          OutlinedButton(
            onClick = {
              actionError = null
              try {
                context.startActivity(Intent(Intent.ACTION_VIEW, mapUri))
              } catch (_: ActivityNotFoundException) {
                actionError = "Nao foi possivel abrir o mapa neste aparelho."
              }
            },
          ) {
            Text("Mapa")
          }
        } else {
          Text(
            text = "Endereco pendente",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.primary,
          )
        }
      }

      Spacer(Modifier.height(8.dp))
      OutlinedButton(
        enabled = !historyLoading,
        onClick = {
          showHistory = !showHistory
          if (!showHistory && events.isEmpty()) loadHistory()
        },
      ) {
        Text(if (showHistory) "Ocultar historico" else "Historico")
      }

      if (showHistory) {
        Spacer(Modifier.height(8.dp))
        DeliveryHistory(
          events = events,
          loading = historyLoading,
          error = historyError,
          onRetry = { loadHistory() },
        )
      }

      actionError?.let {
        Spacer(Modifier.height(8.dp))
        Text(it, color = MaterialTheme.colorScheme.error)
      }

      if (canAccept) {
        Spacer(Modifier.height(12.dp))
        Button(
          enabled = !submitting,
          onClick = {
            scope.launch {
              submitting = true
              actionError = null
              try {
                repository.accept(delivery.id, acceptingCourierId)
                markHistoryStale()
                onAvailabilityChanged(false)
                onAccepted()
              } catch (failure: Exception) {
                actionError = failure.message ?: "Nao foi possivel aceitar."
              } finally {
                submitting = false
              }
            }
          },
        ) {
          Text(if (submitting) "Aceitando..." else "Aceitar")
        }
      } else if (acceptingCourierId != null && !available) {
        Spacer(Modifier.height(12.dp))
        Text("Ative sua disponibilidade para aceitar corridas.", style = MaterialTheme.typography.bodySmall)
      }

      if (!canAccept && primaryAction != null && primaryAction.action != "deliver") {
        Spacer(Modifier.height(12.dp))
        Button(
          enabled = !submitting,
          onClick = {
            scope.launch {
              submitting = true
              actionError = null
              try {
                runDeliveryAction(repository, primaryAction, delivery.id)
                markHistoryStale()
                onAccepted()
              } catch (failure: Exception) {
                actionError = failure.message ?: "Nao foi possivel atualizar."
              } finally {
                submitting = false
              }
            }
          },
        ) {
          Text(if (submitting) "Salvando..." else primaryAction.label)
        }
      }

      if (delivery.status == "EM_ROTA") {
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          Button(
            enabled = !submitting,
            onClick = {
              showDeliveryForm = !showDeliveryForm
              if (showProblemForm) showProblemForm = false
            },
          ) {
            Text("Entregar")
          }
          OutlinedButton(
            enabled = !submitting,
            onClick = {
              showProblemForm = !showProblemForm
              if (showDeliveryForm) showDeliveryForm = false
            },
          ) {
            Text("Problema")
          }
        }
      }

      if (showDeliveryForm) {
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
          value = deliveryNotes,
          onValueChange = { deliveryNotes = it },
          label = { Text("Confirmacao da entrega") },
          placeholder = { Text("Ex: recebido por Maria, portaria, casa 2") },
          modifier = Modifier.fillMaxWidth(),
          minLines = 2,
        )
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          OutlinedButton(
            enabled = !submitting,
            onClick = {
              actionError = null
              val photo = createProofPhotoUri(context, delivery.id)
              proofPhotoUri = photo.uri
              proofPhotoName = photo.fileName
              proofReady = false
              proofCameraLauncher.launch(photo.uri)
            },
          ) {
            Text(if (proofReady) "Trocar foto opcional" else "Adicionar foto opcional")
          }
          if (proofReady) {
            OutlinedButton(
              enabled = !submitting,
              onClick = {
                proofPhotoUri = null
                proofPhotoName = null
                proofReady = false
              },
            ) {
              Text("Remover foto")
            }
          }
        }
        if (proofReady) {
          Spacer(Modifier.height(4.dp))
          Text("Foto pronta para envio.", style = MaterialTheme.typography.bodySmall)
        }
        Spacer(Modifier.height(8.dp))
        Button(
          enabled = !submitting && deliveryNotes.trim().length >= 3,
          onClick = {
            scope.launch {
              submitting = true
              actionError = null
              try {
                val proofId = if (proofReady && proofPhotoUri != null && proofPhotoName != null) {
                  val photoBytes = compressProofPhoto(context, proofPhotoUri!!)
                  repository.uploadProof(
                    deliveryId = delivery.id,
                    fileName = proofPhotoName!!,
                    mimeType = "image/jpeg",
                    contentBase64 = Base64.encodeToString(photoBytes, Base64.NO_WRAP),
                  ).id
                } else {
                  null
                }
                repository.deliver(delivery.id, deliveryNotes.trim(), proofId)
                markHistoryStale()
                deliveryNotes = ""
                showDeliveryForm = false
                proofPhotoUri = null
                proofPhotoName = null
                proofReady = false
                onAccepted()
              } catch (failure: Exception) {
                actionError = failure.message ?: "Nao foi possivel concluir a entrega."
              } finally {
                submitting = false
              }
            }
          },
        ) {
          Text(if (submitting) "Concluindo..." else "Confirmar entrega")
        }
      }

      if (showProblemForm) {
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
          value = problemNotes,
          onValueChange = { problemNotes = it },
          label = { Text("Observacao do problema") },
          modifier = Modifier.fillMaxWidth(),
          minLines = 2,
        )
        Spacer(Modifier.height(8.dp))
        Button(
          enabled = !submitting && problemNotes.trim().length >= 3,
          onClick = {
            scope.launch {
              submitting = true
              actionError = null
              try {
                repository.problem(delivery.id, problemNotes.trim())
                markHistoryStale()
                problemNotes = ""
                showProblemForm = false
                onAccepted()
              } catch (failure: Exception) {
                actionError = failure.message ?: "Nao foi possivel registrar problema."
              } finally {
                submitting = false
              }
            }
          },
        ) {
          Text("Registrar problema")
        }
      }
    }
  }
}

@Composable
private fun DeliveryHistory(
  events: List<DeliveryEventDto>,
  loading: Boolean,
  error: String?,
  onRetry: () -> Unit,
) {
  Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
    Text("Historico da entrega", style = MaterialTheme.typography.titleSmall)
    when {
      loading -> Text("Carregando historico...", style = MaterialTheme.typography.bodySmall)
      error != null -> {
        Text(error, color = MaterialTheme.colorScheme.error)
        OutlinedButton(onClick = onRetry) {
          Text("Tentar novamente")
        }
      }
      events.isEmpty() -> Text("Nenhum evento registrado.", style = MaterialTheme.typography.bodySmall)
      else -> events.forEach { event ->
        Column {
          Text(deliveryEventTypeLabel(event.type), style = MaterialTheme.typography.bodyMedium)
          deliveryEventNotesText(event)?.let {
            Text(it, style = MaterialTheme.typography.bodySmall)
          }
          Text(
            listOfNotNull(deliveryEventActorLabel(event), deliveryEventTimestampLabel(event.createdAt))
              .joinToString(" - "),
            style = MaterialTheme.typography.labelSmall,
          )
        }
      }
    }
  }
}

private data class LifecycleAction(
  val label: String,
  val action: String,
)

private fun lifecyclePrimaryAction(status: String): LifecycleAction? {
  return when (status) {
    "ACEITA_PELO_MOTOBOY" -> LifecycleAction(label = "Coletar", action = "collect")
    "COLETADA" -> LifecycleAction(label = "Sair em rota", action = "startRoute")
    "EM_ROTA" -> LifecycleAction(label = "Entregar", action = "deliver")
    else -> null
  }
}

private data class ProofPhotoTarget(
  val uri: Uri,
  val fileName: String,
)

private fun createProofPhotoUri(context: Context, deliveryId: String): ProofPhotoTarget {
  val directory = File(context.cacheDir, "delivery-proofs").apply {
    mkdirs()
  }
  val fileName = "proof-${deliveryId.take(8)}-${System.currentTimeMillis()}.jpg"
  val file = File(directory, fileName)
  return ProofPhotoTarget(
    uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file),
    fileName = fileName,
  )
}

private fun compressProofPhoto(context: Context, uri: Uri): ByteArray {
  val original = context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it) }
    ?: throw IllegalStateException("Nao foi possivel ler a foto.")
  val scaled = scaleBitmap(original, maxSide = 1600)
  if (scaled !== original) {
    original.recycle()
  }

  try {
    var quality = 82
    var bytes = encodeJpeg(scaled, quality)
    while (bytes.size > MAX_PROOF_PHOTO_BYTES && quality > 45) {
      quality -= 8
      bytes = encodeJpeg(scaled, quality)
    }
    if (bytes.size > MAX_PROOF_PHOTO_BYTES) {
      throw IllegalStateException("A foto ficou acima de 4 MB mesmo apos compressao.")
    }
    return bytes
  } finally {
    scaled.recycle()
  }
}

private fun scaleBitmap(bitmap: Bitmap, maxSide: Int): Bitmap {
  val largestSide = max(bitmap.width, bitmap.height)
  if (largestSide <= maxSide) return bitmap

  val ratio = maxSide.toFloat() / largestSide.toFloat()
  val width = (bitmap.width * ratio).toInt().coerceAtLeast(1)
  val height = (bitmap.height * ratio).toInt().coerceAtLeast(1)
  return Bitmap.createScaledBitmap(bitmap, width, height, true)
}

private fun encodeJpeg(bitmap: Bitmap, quality: Int): ByteArray {
  val output = ByteArrayOutputStream()
  bitmap.compress(Bitmap.CompressFormat.JPEG, quality, output)
  return output.toByteArray()
}

private const val MAX_PROOF_PHOTO_BYTES = 4 * 1024 * 1024

private suspend fun runDeliveryAction(
  repository: DeliveryRepository,
  lifecycleAction: LifecycleAction,
  deliveryId: String,
) {
  when (lifecycleAction.action) {
    "collect" -> repository.collect(deliveryId)
    "startRoute" -> repository.startRoute(deliveryId)
    "deliver" -> repository.deliver(deliveryId)
  }
}
