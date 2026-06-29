import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/backend/firebase_storage/storage.dart';
import '/flutter_flow/flutter_flow_drop_down.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
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
import 'painel_parceiro_widget.dart' show PainelParceiroWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mask_text_input_formatter/mask_text_input_formatter.dart';
import 'package:provider/provider.dart';
import 'package:text_search/text_search.dart';

class PainelParceiroModel extends FlutterFlowModel<PainelParceiroWidget> {
  ///  State fields for stateful widgets in this page.

  final formKey = GlobalKey<FormState>();
  bool isDataUploading_uploadData9 = false;
  FFUploadedFile uploadedLocalFile_uploadData9 =
      FFUploadedFile(bytes: Uint8List.fromList([]), originalFilename: '');
  String uploadedFileUrl_uploadData9 = '';

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
  FocusNode? telefoneFocusNode1;
  TextEditingController? telefoneTextController1;
  late MaskTextInputFormatter telefoneMask1;
  String? Function(BuildContext, String?)? telefoneTextController1Validator;
  String? _telefoneTextController1Validator(BuildContext context, String? val) {
    if (val == null || val.isEmpty) {
      return 'Telefone is required';
    }

    return null;
  }

  // State field(s) for Telefone widget.
  FocusNode? telefoneFocusNode2;
  TextEditingController? telefoneTextController2;
  String? Function(BuildContext, String?)? telefoneTextController2Validator;
  String? _telefoneTextController2Validator(BuildContext context, String? val) {
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
  // State field(s) for TextField widget.
  FocusNode? textFieldFocusNode;
  TextEditingController? textController5;
  String? Function(BuildContext, String?)? textController5Validator;
  List<CupomRecord> simpleSearchResults = [];

  @override
  void initState(BuildContext context) {
    yourNameTextControllerValidator = _yourNameTextControllerValidator;
    descricaoTextControllerValidator = _descricaoTextControllerValidator;
    telefoneTextController1Validator = _telefoneTextController1Validator;
    telefoneTextController2Validator = _telefoneTextController2Validator;
  }

  @override
  void dispose() {
    yourNameFocusNode?.dispose();
    yourNameTextController?.dispose();

    descricaoFocusNode?.dispose();
    descricaoTextController?.dispose();

    telefoneFocusNode1?.dispose();
    telefoneTextController1?.dispose();

    telefoneFocusNode2?.dispose();
    telefoneTextController2?.dispose();

    textFieldFocusNode?.dispose();
    textController5?.dispose();
  }
}
