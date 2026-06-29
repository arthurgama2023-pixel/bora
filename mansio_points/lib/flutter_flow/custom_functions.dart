import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:timeago/timeago.dart' as timeago;
import 'lat_lng.dart';
import 'place.dart';
import 'uploaded_file.dart';
import '/backend/backend.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '/backend/schema/structs/index.dart';
import '/auth/firebase_auth/auth_util.dart';

double? tirarVirgula(String? valor) {
  // Função que recebe um valor, verifica se existe vírgula ou ponto
  // e remove ambos antes da conversão para double
  if (valor == null) {
    return null;
  }

  // Remove tanto vírgulas quanto pontos
  valor = valor.replaceAll(',', '').replaceAll('.', '');

  return double.tryParse(valor);
}

double? trocarVirgulaCopy(String? valor) {
  // Função que recebe um valor, verifica se existe vírgula ou ponto
  // e remove ambos antes da conversão para double
  if (valor == null) {
    return null;
  }

  // Remove tanto vírgulas quanto pontos
  valor = valor.replaceAll(',', '.');

  return double.tryParse(valor);
}

int? removerNumeros(String? valor) {
  if (valor == null || valor.isEmpty) {
    return null;
  }

  // Remove todos os caracteres não numéricos antes do primeiro ponto/vírgula
  final buffer = StringBuffer();
  bool encontrouSeparador = false;

  for (var i = 0; i < valor.length; i++) {
    final char = valor[i];

    if (char == '.' || char == ',') {
      encontrouSeparador = true;
      break;
    }

    if (char.codeUnitAt(0) >= 48 && char.codeUnitAt(0) <= 57) {
      // Verifica se é dígito (0-9)
      buffer.write(char);
    }
  }

  final numeroString = buffer.toString();
  if (numeroString.isEmpty) {
    return null;
  }

  return int.tryParse(numeroString);
}

double? verificar(double? numero) {
  // receba um numero e verifique se ele possui virgula ou ponto, se sim entao adicionar 00 no final do numero. por exemplo recebeu 10 vai adicionar os zeros para ficar assim1000
  if (numero == null) {
    return null;
  }

  String numeroString = numero.toString();

  if (numeroString.contains(',') || numeroString.contains('.')) {
    return numero * 100; // Adiciona 00 no final
  }

  return numero *
      100; // Adiciona 00 no final mesmo se não tiver vírgula ou ponto
}

int? soma(List<int>? listaNumero) {
  // crie uma funcao que ira receber uma lista de nuemros e ira somalos
  if (listaNumero == null || listaNumero.isEmpty) {
    return null;
  }
  return listaNumero.reduce((a, b) => a + b);
}

double? media(List<double>? lista) {
  // corriga para que receba uma lista de double e retornasse a media em double
  if (lista == null || lista.isEmpty) {
    return null;
  }
  double soma = lista.reduce((a, b) => a + b);
  return soma / lista.length;
}

int? calcularpontos(double? valor) {
  // cria uma funcao que permita receber um numero double e dividilo por 100
// Função que recebe um número double e o divide por 100
  if (valor == null) {
    return null;
  }
  return (valor / 100)
      .round(); // Retorna o valor dividido por 100, arredondado para o inteiro mais próximo
}

String? craindoValor(
  double? valor,
  double? adicional,
) {
  // some dois valores e retorno o valor do resultado em formato string
  if (valor == null || adicional == null) {
    return null;
  }
  double resultado = valor + adicional;
  return resultado.toString(); // Retorna o resultado em formato string
}

double? removerCep(String? valor) {
  // caso tenha o sinal de ponto separando os numeros, deve considerar esse ponto quando tranformar em double, apos o ponto fica os numeros decimal
  if (valor == null || valor.isEmpty) {
    return null;
  }
  // Remove any non-numeric characters except for the decimal point
  String sanitizedValue = valor.replaceAll(RegExp(r'[^0-9.]'), '');
  // Convert to double
  return double.tryParse(sanitizedValue);
}

double? calcularDesconto(
  double? valor,
  double? desconto,
) {
  // receba o valor e o vlaor do desconto, e retorno o valor ja descontado o percentual do desconto. exemplo: valor 50 desconto 20 ( esse vinte se refere a 20 por cento ou 0.20)
  if (valor == null || desconto == null) {
    return null; // Retorna null se algum dos valores for nulo
  }
  return valor - (valor * (desconto / 100)); // Calcula o valor com desconto
}
