import '/auth/firebase_auth/auth_util.dart';
import '/backend/api_requests/api_calls.dart';
import '/backend/backend.dart';
import '/componentes/pagamento_pix_mark/pagamento_pix_mark_widget.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:ui';
import '/flutter_flow/custom_functions.dart' as functions;
import '/index.dart';
import 'carrinho_widget.dart' show CarrinhoWidget;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class CarrinhoModel extends FlutterFlowModel<CarrinhoWidget> {
  ///  State fields for stateful widgets in this page.

  // Stores action output result for [Backend Call - Create Document] action in Button widget.
  ComprasRecord? saidaCompras;
  // Stores action output result for [Backend Call - API (CriarTranferencia)] action in Button widget.
  ApiCallResponse? apiResultvs1;

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {}
}
