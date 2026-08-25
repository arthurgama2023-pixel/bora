import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/backend/firebase_storage/storage.dart';
import '/flutter_flow/flutter_flow_place_picker.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/flutter_flow/place.dart';
import '/flutter_flow/upload_data.dart';
import 'dart:io';
import 'dart:ui';
import '/index.dart';
import 'completar_cadastro_widget.dart' show CompletarCadastroWidget;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class CompletarCadastroModel extends FlutterFlowModel<CompletarCadastroWidget> {
  ///  State fields for stateful widgets in this page.

  final formKey = GlobalKey<FormState>();
  bool isDataUploading_uploadData = false;
  FFUploadedFile uploadedLocalFile_uploadData =
      FFUploadedFile(bytes: Uint8List.fromList([]), originalFilename: '');
  String uploadedFileUrl_uploadData = '';

  // State field(s) for Telefone widget.
  FocusNode? telefoneFocusNode;
  TextEditingController? telefoneTextController;
  String? Function(BuildContext, String?)? telefoneTextControllerValidator;
  String? _telefoneTextControllerValidator(BuildContext context, String? val) {
    if (val == null || val.isEmpty) {
      return 'Telefone/Whatsapp is required';
    }

    return null;
  }

  // State field(s) for Endereco widget.
  FocusNode? enderecoFocusNode;
  TextEditingController? enderecoTextController;
  String? Function(BuildContext, String?)? enderecoTextControllerValidator;
  // State field(s) for PlacePicker widget.
  FFPlace placePickerValue = FFPlace();
  // State field(s) for CPF widget.
  FocusNode? cpfFocusNode;
  TextEditingController? cpfTextController;
  String? Function(BuildContext, String?)? cpfTextControllerValidator;
  String? _cpfTextControllerValidator(BuildContext context, String? val) {
    if (val == null || val.isEmpty) {
      return 'CPF is required';
    }

    return null;
  }

  @override
  void initState(BuildContext context) {
    telefoneTextControllerValidator = _telefoneTextControllerValidator;
    cpfTextControllerValidator = _cpfTextControllerValidator;
  }

  @override
  void dispose() {
    telefoneFocusNode?.dispose();
    telefoneTextController?.dispose();

    enderecoFocusNode?.dispose();
    enderecoTextController?.dispose();

    cpfFocusNode?.dispose();
    cpfTextController?.dispose();
  }
}
