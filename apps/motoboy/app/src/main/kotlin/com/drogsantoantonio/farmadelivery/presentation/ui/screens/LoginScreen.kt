package com.drogsantoantonio.farmadelivery.presentation.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.drogsantoantonio.farmadelivery.R

@Composable
fun LoginScreen(
  loading: Boolean,
  onLogin: (identifier: String, password: String, onError: (String) -> Unit) -> Unit,
) {
  var identifier by remember { mutableStateOf("") }
  var password by remember { mutableStateOf("") }
  var error by remember { mutableStateOf<String?>(null) }
  var submitting by remember { mutableStateOf(false) }

  Surface {
    Column(
      modifier = Modifier
        .fillMaxSize()
        .padding(24.dp),
      verticalArrangement = Arrangement.Center,
      horizontalAlignment = Alignment.CenterHorizontally,
    ) {
      Image(
        painter = painterResource(R.drawable.drogaria_santo_antonio_logo),
        contentDescription = "Drogaria Santo Antonio",
        modifier = Modifier.size(110.dp),
      )
      Spacer(Modifier.height(18.dp))
      Text("FarmaDelivery", style = MaterialTheme.typography.headlineMedium)
      Text("Motoboy", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
      Spacer(Modifier.height(28.dp))

      OutlinedTextField(
        value = identifier,
        onValueChange = { identifier = it },
        label = { Text("Telefone ou email") },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
      )
      Spacer(Modifier.height(12.dp))
      OutlinedTextField(
        value = password,
        onValueChange = { password = it },
        label = { Text("Senha") },
        modifier = Modifier.fillMaxWidth(),
        visualTransformation = PasswordVisualTransformation(),
        singleLine = true,
      )
      Spacer(Modifier.height(16.dp))

      error?.let {
        Text(it, color = MaterialTheme.colorScheme.error)
        Spacer(Modifier.height(12.dp))
      }

      Button(
        enabled = !loading && !submitting && identifier.isNotBlank() && password.isNotBlank(),
        modifier = Modifier.fillMaxWidth(),
        onClick = {
          submitting = true
          error = null
          onLogin(identifier.trim(), password) {
            submitting = false
            error = it
          }
        },
      ) {
        if (loading || submitting) {
          CircularProgressIndicator()
        } else {
          Text("Entrar")
        }
      }
    }
  }
}
