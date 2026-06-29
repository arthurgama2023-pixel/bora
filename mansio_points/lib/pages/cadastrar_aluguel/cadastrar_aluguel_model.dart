import '/auth/firebase_auth/auth_util.dart';
import '/backend/api_requests/api_calls.dart';
import '/backend/backend.dart';
import '/backend/firebase_storage/storage.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/flutter_flow/upload_data.dart';
import 'dart:ui';
import '/flutter_flow/custom_functions.dart' as functions;
import '/index.dart';
import 'cadastrar_aluguel_widget.dart' show CadastrarAluguelWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class CadastrarAluguelModel extends FlutterFlowModel<CadastrarAluguelWidget> {
  ///  State fields for stateful widgets in this page.

  bool isDataUploading_fotoComprovante = false;
  FFUploadedFile uploadedLocalFile_fotoComprovante =
      FFUploadedFile(bytes: Uint8List.fromList([]), originalFilename: '');
  String uploadedFileUrl_fotoComprovante = '';

  // State field(s) for nomeDestino widget.
  FocusNode? nomeDestinoFocusNode;
  TextEditingController? nomeDestinoTextController;
  String? Function(BuildContext, String?)? nomeDestinoTextControllerValidator;
  // State field(s) for valor widget.
  FocusNode? valorFocusNode;
  TextEditingController? valorTextController;
  String? Function(BuildContext, String?)? valorTextControllerValidator;
  // Stores action output result for [Backend Call - API (CriarTranferencia)] action in Button widget.
  ApiCallResponse? apiCall;
  // Stores action output result for [Backend Call - Create Document] action in Button widget.
  AlugueisRecord? saidaAlug;

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {
    nomeDestinoFocusNode?.dispose();
    nomeDestinoTextController?.dispose();

    valorFocusNode?.dispose();
    valorTextController?.dispose();
  }
}
