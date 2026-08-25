import '/auth/firebase_auth/auth_util.dart';
import '/backend/api_requests/api_calls.dart';
import '/backend/backend.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:ui';
import '/index.dart';
import 'comprovante_confere_widget.dart' show ComprovanteConfereWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class ComprovanteConfereModel
    extends FlutterFlowModel<ComprovanteConfereWidget> {
  ///  State fields for stateful widgets in this page.

  // Stores action output result for [Backend Call - API (ConsultarPagamanto)] action in Botao widget.
  ApiCallResponse? apiResultbck;

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {}
}
