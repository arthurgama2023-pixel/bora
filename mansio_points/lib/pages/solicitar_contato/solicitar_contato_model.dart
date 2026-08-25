import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/backend/firebase_storage/storage.dart';
import '/flutter_flow/flutter_flow_drop_down.dart';
import '/flutter_flow/flutter_flow_place_picker.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/flutter_flow/form_field_controller.dart';
import '/flutter_flow/place.dart';
import '/flutter_flow/upload_data.dart';
import 'dart:io';
import 'dart:ui';
import '/index.dart';
import 'solicitar_contato_widget.dart' show SolicitarContatoWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mask_text_input_formatter/mask_text_input_formatter.dart';
import 'package:provider/provider.dart';

class SolicitarContatoModel extends FlutterFlowModel<SolicitarContatoWidget> {
  ///  State fields for stateful widgets in this page.

  final formKey = GlobalKey<FormState>();
  bool isDataUploading_uploadData98 = false;
  FFUploadedFile uploadedLocalFile_uploadData98 =
      FFUploadedFile(bytes: Uint8List.fromList([]), originalFilename: '');
  String uploadedFileUrl_uploadData98 = '';

  // State field(s) for yourName widget.
  FocusNode? yourNameFocusNode;
  TextEditingController? yourNameTextController;
  String? Function(BuildContext, String?)? yourNameTextControllerValidator;
  String? _yourNameTextControllerValidator(BuildContext context, String? val) {
    if (val == null || val.isEmpty) {
      return 'nome is required';
    }

    return null;
  }

  // State field(s) for descricao widget.
  FocusNode? descricaoFocusNode;
  TextEditingController? descricaoTextController;
  String? Function(BuildContext, String?)? descricaoTextControllerValidator;
  String? _descricaoTextControllerValidator(BuildContext context, String? val) {
    if (val == null || val.isEmpty) {
      return 'Descrição is required';
    }

    return null;
  }

  // State field(s) for Telefone widget.
  FocusNode? telefoneFocusNode;
  TextEditingController? telefoneTextController;
  late MaskTextInputFormatter telefoneMask;
  String? Function(BuildContext, String?)? telefoneTextControllerValidator;
  String? _telefoneTextControllerValidator(BuildContext context, String? val) {
    if (val == null || val.isEmpty) {
      return 'Telefone is required';
    }

    return null;
  }

  // State field(s) for email widget.
  FocusNode? emailFocusNode;
  TextEditingController? emailTextController;
  String? Function(BuildContext, String?)? emailTextControllerValidator;
  String? _emailTextControllerValidator(BuildContext context, String? val) {
    if (val == null || val.isEmpty) {
      return 'Email is required';
    }

    return null;
  }

  // State field(s) for pagina widget.
  FocusNode? paginaFocusNode;
  TextEditingController? paginaTextController;
  String? Function(BuildContext, String?)? paginaTextControllerValidator;
  String? _paginaTextControllerValidator(BuildContext context, String? val) {
    if (val == null || val.isEmpty) {
      return 'Pagina/Site is required';
    }

    return null;
  }

  // State field(s) for desconto widget.
  FocusNode? descontoFocusNode;
  TextEditingController? descontoTextController;
  String? Function(BuildContext, String?)? descontoTextControllerValidator;
  String? _descontoTextControllerValidator(BuildContext context, String? val) {
    if (val == null || val.isEmpty) {
      return 'Porcentagem de desconto is required';
    }

    return null;
  }

  // State field(s) for DropDown widget.
  String? dropDownValue;
  FormFieldController<String>? dropDownValueController;
  // State field(s) for PlacePicker widget.
  FFPlace placePickerValue = FFPlace();
  // Stores action output result for [Backend Call - Create Document] action in Button widget.
  ParceirosRecord? saidaParceiro;

  @override
  void initState(BuildContext context) {
    yourNameTextControllerValidator = _yourNameTextControllerValidator;
    descricaoTextControllerValidator = _descricaoTextControllerValidator;
    telefoneTextControllerValidator = _telefoneTextControllerValidator;
    emailTextControllerValidator = _emailTextControllerValidator;
    paginaTextControllerValidator = _paginaTextControllerValidator;
    descontoTextControllerValidator = _descontoTextControllerValidator;
  }

  @override
  void dispose() {
    yourNameFocusNode?.dispose();
    yourNameTextController?.dispose();

    descricaoFocusNode?.dispose();
    descricaoTextController?.dispose();

    telefoneFocusNode?.dispose();
    telefoneTextController?.dispose();

    emailFocusNode?.dispose();
    emailTextController?.dispose();

    paginaFocusNode?.dispose();
    paginaTextController?.dispose();

    descontoFocusNode?.dispose();
    descontoTextController?.dispose();
  }
}
