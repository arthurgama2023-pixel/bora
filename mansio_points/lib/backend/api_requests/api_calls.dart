import 'dart:convert';
import 'dart:typed_data';
import '../cloud_functions/cloud_functions.dart';
import '../schema/structs/index.dart';

import 'package:flutter/foundation.dart';

import '/flutter_flow/flutter_flow_util.dart';
import 'api_manager.dart';

export 'api_manager.dart' show ApiCallResponse;

const _kPrivateApiFunctionName = 'mansiopointapp';

class ConsultarPagamantoCall {
  static Future<ApiCallResponse> call({
    String? apiKey =
        'afa22d55-fa18-4a53-94e3-1a6df7e94c24d53357f34ec6b5a6cb48c155c525269053df-1fe5-44e0-91dc-6bcad453880e',
    String? orderId = '',
  }) async {
    final response = await makeCloudCall(
      _kPrivateApiFunctionName,
      {
        'callName': 'ConsultarPagamantoCall',
        'variables': {
          'apiKey': apiKey,
          'orderId': orderId,
        },
      },
    );
    return ApiCallResponse.fromCloudCallResponse(response);
  }

  static String? qrcode(dynamic response) => castToType<String>(getJsonField(
        response,
        r'''$.qr_codes[:].text''',
      ));
  static int? valor(dynamic response) => castToType<int>(getJsonField(
        response,
        r'''$.qr_codes[:].amount.value''',
      ));
  static String? status(dynamic response) => castToType<String>(getJsonField(
        response,
        r'''$.charges[:].status''',
      ));
  static String? dataDoPagamento(dynamic response) =>
      castToType<String>(getJsonField(
        response,
        r'''$.charges[:].paid_at''',
      ));
  static String? idPagamento(dynamic response) =>
      castToType<String>(getJsonField(
        response,
        r'''$.charges[:].id''',
      ));
}

class CriarTranferenciaCall {
  static Future<ApiCallResponse> call({
    String? apiKey =
        'afa22d55-fa18-4a53-94e3-1a6df7e94c24d53357f34ec6b5a6cb48c155c525269053df-1fe5-44e0-91dc-6bcad453880e',
    String? preco = '',
    String? cpf = '',
    String? descricao = '',
    String? cliente = '',
    String? email = '',
    String? id = '',
    int? porcentagem,
  }) async {
    final response = await makeCloudCall(
      _kPrivateApiFunctionName,
      {
        'callName': 'CriarTranferenciaCall',
        'variables': {
          'apiKey': apiKey,
          'preco': preco,
          'cpf': cpf,
          'descricao': descricao,
          'cliente': cliente,
          'email': email,
          'id': id,
          'porcentagem': porcentagem,
        },
      },
    );
    return ApiCallResponse.fromCloudCallResponse(response);
  }

  static String? idCOdigo(dynamic response) => castToType<String>(getJsonField(
        response,
        r'''$.qr_codes[:].id''',
      ));
  static int? valor(dynamic response) => castToType<int>(getJsonField(
        response,
        r'''$.qr_codes[:].amount.value''',
      ));
  static String? qRcode(dynamic response) => castToType<String>(getJsonField(
        response,
        r'''$.qr_codes[:].text''',
      ));
  static String? email(dynamic response) => castToType<String>(getJsonField(
        response,
        r'''$.customer.email''',
      ));
  static String? nome(dynamic response) => castToType<String>(getJsonField(
        response,
        r'''$.customer.name''',
      ));
  static String? cpf(dynamic response) => castToType<String>(getJsonField(
        response,
        r'''$.customer.tax_id''',
      ));
  static String? data(dynamic response) => castToType<String>(getJsonField(
        response,
        r'''$.created_at''',
      ));
  static String? referenciaPix(dynamic response) =>
      castToType<String>(getJsonField(
        response,
        r'''$.reference_id''',
      ));
  static String? idOrdem(dynamic response) => castToType<String>(getJsonField(
        response,
        r'''$.id''',
      ));
}

class CalcularFreteCall {
  static Future<ApiCallResponse> call({
    String? token =
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI5NTYiLCJqdGkiOiJkNzQ1YTRmOGY0YTFhZjk3OGY2NzI0MzZjOTc5OTFjOTNjNDcwYWFmOGEyMzFlNzAyY2VlOGNhZmI3MTI3ZjA1MTNmMjJkZWI2NzgyYmVhMiIsImlhdCI6MTc3MjQ4Mzg4My40OTIzNzcsIm5iZiI6MTc3MjQ4Mzg4My40OTIzOCwiZXhwIjoxODA0MDE5ODgzLjQ4NDI1Miwic3ViIjoiYTEzNGRhODItZjgxOC00OTE0LTg4YmQtYjZiYzVjNWY0NmU5Iiwic2NvcGVzIjpbInNoaXBwaW5nLWNhbGN1bGF0ZSIsInNoaXBwaW5nLXRyYWNraW5nIiwic2hpcHBpbmctZ2VuZXJhdGUiLCJzaGlwcGluZy1wcmV2aWV3Iiwic2hpcHBpbmctcHJpbnQiLCJzaGlwcGluZy1zaGFyZSIsInNoaXBwaW5nLWNhbmNlbCIsInNoaXBwaW5nLWNoZWNrb3V0Iiwic2hpcHBpbmctY29tcGFuaWVzIl19.jwouuCzRX13XuwYq4O1mbo2d56AlPDK-iWou8j1nenD6WQ_yPlk4W2uI2qEI64kBKM-ufbJppThC6GO05v7QRoqVV3axIJiZbDoFzhcBZhGzDeT6e0Qu75To6MIC8henyEqXgov607ZFBieHOx1rbYZgBGzwrIExJDjw50M1Ag8Gv4Wr61BDT2FWj4SrurNXl0GzBYka_dxH6oRhwtcejYoidFq9oDgeNdABIUFLtLqCSyxy0TDwJj_VcG8mj_G6C7soLXrPzOtIJFL9_y2xy-9QkC0pSkBnxqtf1Gos1Aeyc8fuuJtnEy1WV4u4bWoRp5ZFi82UZLL_d2tTtHDlP1jlQwP0qCYHngp93geG-sVAQKwloZVOpD6uzfpDcnALSrTSkKQCKF0hc3EZiuI4P0PBbLEYWzoRpjavruntHa6lYVVW-wOggGrUCxYkWUd2rrHehR0DtwedMUQEe02WV3aM-WNdEmiLrxC0cvf55z-ViEEXZFO9zRfEN7w7r9YfNKBQIjaLAxiEZC9X0eia7zE5DMzJRrG07eToYicn0ZIoNKBe901E17HeVcPl7rhBcdBIqu85qa90FH97zcX9HFFF1k8d4Izlgnu6fyPj448KUcYdrjAIKOzJ-K6c-ztXLjXCLCAM752QKFjvTLxBdYz3aqgH4ZqOTXWGpuyXCUY',
    String? cepEnvio = '',
    String? cepDestino = '',
    String? id = '',
    int? largura,
    int? altura,
    int? comprimento,
    double? peso,
    double? valorProduto,
    int? quantidade,
  }) async {
    final response = await makeCloudCall(
      _kPrivateApiFunctionName,
      {
        'callName': 'CalcularFreteCall',
        'variables': {
          'token': token,
          'cepEnvio': cepEnvio,
          'cepDestino': cepDestino,
          'id': id,
          'largura': largura,
          'altura': altura,
          'comprimento': comprimento,
          'peso': peso,
          'valorProduto': valorProduto,
          'quantidade': quantidade,
        },
      },
    );
    return ApiCallResponse.fromCloudCallResponse(response);
  }

  static List<String>? nomeComp(dynamic response) => (getJsonField(
        response,
        r'''$[:].company.name''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<String>(x))
          .withoutNulls
          .toList();
  static List<String>? imagens(dynamic response) => (getJsonField(
        response,
        r'''$[:].company.picture''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<String>(x))
          .withoutNulls
          .toList();
  static List<int>? id(dynamic response) => (getJsonField(
        response,
        r'''$[:].id''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<int>(x))
          .withoutNulls
          .toList();
  static List<String>? tipoEnvio(dynamic response) => (getJsonField(
        response,
        r'''$[:].name''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<String>(x))
          .withoutNulls
          .toList();
  static List<String>? erro(dynamic response) => (getJsonField(
        response,
        r'''$[:].error''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<String>(x))
          .withoutNulls
          .toList();
  static List? compan(dynamic response) => getJsonField(
        response,
        r'''$[:].company''',
        true,
      ) as List?;
  static List<int>? idComp(dynamic response) => (getJsonField(
        response,
        r'''$[:].company.id''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<int>(x))
          .withoutNulls
          .toList();
}

class ApiPagingParams {
  int nextPageNumber = 0;
  int numItems = 0;
  dynamic lastResponse;

  ApiPagingParams({
    required this.nextPageNumber,
    required this.numItems,
    required this.lastResponse,
  });

  @override
  String toString() =>
      'PagingParams(nextPageNumber: $nextPageNumber, numItems: $numItems, lastResponse: $lastResponse,)';
}

String _toEncodable(dynamic item) {
  if (item is DocumentReference) {
    return item.path;
  }
  return item;
}

String _serializeList(List? list) {
  list ??= <String>[];
  try {
    return json.encode(list, toEncodable: _toEncodable);
  } catch (_) {
    if (kDebugMode) {
      print("List serialization failed. Returning empty list.");
    }
    return '[]';
  }
}

String _serializeJson(dynamic jsonVar, [bool isList = false]) {
  jsonVar ??= (isList ? [] : {});
  try {
    return json.encode(jsonVar, toEncodable: _toEncodable);
  } catch (_) {
    if (kDebugMode) {
      print("Json serialization failed. Returning empty json.");
    }
    return isList ? '[]' : '{}';
  }
}

String? escapeStringForJson(String? input) {
  if (input == null) {
    return null;
  }
  return input
      .replaceAll('\\', '\\\\')
      .replaceAll('"', '\\"')
      .replaceAll('\n', '\\n')
      .replaceAll('\t', '\\t');
}
