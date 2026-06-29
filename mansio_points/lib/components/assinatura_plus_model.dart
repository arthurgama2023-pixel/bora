import '/auth/firebase_auth/auth_util.dart';
import '/backend/api_requests/api_calls.dart';
import '/backend/backend.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:ui';
import '/index.dart';
import 'assinatura_plus_widget.dart' show AssinaturaPlusWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class AssinaturaPlusModel extends FlutterFlowModel<AssinaturaPlusWidget> {
  ///  State fields for stateful widgets in this component.

  // Stores action output result for [Backend Call - API (CriarTranferencia)] action in Button widget.
  ApiCallResponse? saidaApi;
  // Stores action output result for [Backend Call - Create Document] action in Button widget.
  AssinaturasRecord? saidaAssinatura;

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {}
}
