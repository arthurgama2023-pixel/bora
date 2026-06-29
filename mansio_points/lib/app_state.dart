import 'package:flutter/material.dart';
import '/backend/backend.dart';
import '/backend/schema/structs/index.dart';
import '/backend/api_requests/api_manager.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'flutter_flow/flutter_flow_util.dart';

class FFAppState extends ChangeNotifier {
  static FFAppState _instance = FFAppState._internal();

  factory FFAppState() {
    return _instance;
  }

  FFAppState._internal();

  static void reset() {
    _instance = FFAppState._internal();
  }

  Future initializePersistedState() async {}

  void update(VoidCallback callback) {
    callback();
    notifyListeners();
  }

  bool _favorito = false;
  bool get favorito => _favorito;
  set favorito(bool value) {
    _favorito = value;
  }

  int _contador = 0;
  int get contador => _contador;
  set contador(int value) {
    _contador = value;
  }

  /// Valor carregado pela tabela de preços
  double _valor = 0.0;
  double get valor => _valor;
  set valor(double value) {
    _valor = value;
  }

  int _pontos = 0;
  int get pontos => _pontos;
  set pontos(int value) {
    _pontos = value;
  }

  String _preco = '0';
  String get preco => _preco;
  set preco(String value) {
    _preco = value;
  }

  /// para definir se.o pagamento sera em pix ou cartão
  int _indicaroPagamento = 1;
  int get indicaroPagamento => _indicaroPagamento;
  set indicaroPagamento(int value) {
    _indicaroPagamento = value;
  }

  double _frete = 0.0;
  double get frete => _frete;
  set frete(double value) {
    _frete = value;
  }
}
