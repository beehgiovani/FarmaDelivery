package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

enum class OperationalStateTone {
  Neutral,
  Loading,
  Error,
}

@Composable
fun OperationalStateLayout(
  title: String,
  modifier: Modifier = Modifier,
  description: String? = null,
  tone: OperationalStateTone = OperationalStateTone.Neutral,
  actionLabel: String? = null,
  onAction: (() -> Unit)? = null,
) {
  val contentColor = when (tone) {
    OperationalStateTone.Error -> MaterialTheme.colorScheme.error
    OperationalStateTone.Loading -> MaterialTheme.colorScheme.primary
    OperationalStateTone.Neutral -> MaterialTheme.colorScheme.onSurface
  }

  Card(
    modifier = modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
  ) {
    Column(
      verticalArrangement = Arrangement.spacedBy(10.dp),
      modifier = Modifier
        .fillMaxWidth()
        .padding(14.dp),
    ) {
      if (tone == OperationalStateTone.Loading) {
        CircularProgressIndicator()
      }
      Text(title, color = contentColor, style = MaterialTheme.typography.titleSmall)
      description?.takeIf { it.isNotBlank() }?.let {
        Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
      }
      if (actionLabel != null && onAction != null) {
        OutlinedButton(onClick = onAction) {
          Text(actionLabel)
        }
      }
    }
  }
}
