import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/backend/firebase_storage/storage.dart';
import '/components/dimension_input2_widget.dart';
import '/components/input_field_widget.dart';
import '/flutter_flow/flutter_flow_drop_down.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/flutter_flow/form_field_controller.dart';
import '/flutter_flow/upload_data.dart';
import 'dart:ui';
import '/flutter_flow/custom_functions.dart' as functions;
import '/index.dart';
import 'cadastrar_produto_widget.dart' show CadastrarProdutoWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class CadastrarProdutoModel extends FlutterFlowModel<CadastrarProdutoWidget> {
  ///  State fields for stateful widgets in this page.

  final formKey = GlobalKey<FormState>();
  bool isDataUploading_uploadDataOzz = false;
  List<FFUploadedFile> uploadedLocalFiles_uploadDataOzz = [];
  List<String> uploadedFileUrls_uploadDataOzz = [];

  // Model for InputField component.
  late InputFieldModel inputFieldModel;
  // State field(s) for TextField widget.
  FocusNode? textFieldFocusNode1;
  TextEditingController? textController1;
  String? Function(BuildContext, String?)? textController1Validator;
  String? _textController1Validator(BuildContext context, String? val) {
    if (val == null || val.isEmpty) {
      return 'Ex: Smartphone Pro melhor telefone da atualidade ...asa is required';
    }

    return null;
  }

  // State field(s) for DropDown widget.
  String? dropDownValue;
  FormFieldController<String>? dropDownValueController;
  // Model for DimensionInput2 component.
  late DimensionInput2Model dimensionInput2Model1;
  // State field(s) for TextField widget.
  FocusNode? textFieldFocusNode2;
  TextEditingController? textController2;
  String? Function(BuildContext, String?)? textController2Validator;
  String? _textController2Validator(BuildContext context, String? val) {
    if (val == null || val.isEmpty) {
      return 'Quant is required';
    }

    return null;
  }

  // State field(s) for TextField widget.
  FocusNode? textFieldFocusNode3;
  TextEditingController? textController3;
  String? Function(BuildContext, String?)? textController3Validator;
  String? _textController3Validator(BuildContext context, String? val) {
    if (val == null || val.isEmpty) {
      return 'Desconto% is required';
    }

    return null;
  }

  // State field(s) for pontos_plus widget.
  FocusNode? pontosPlusFocusNode;
  TextEditingController? pontosPlusTextController;
  String? Function(BuildContext, String?)? pontosPlusTextControllerValidator;
  // State field(s) for desconto_plus widget.
  FocusNode? descontoPlusFocusNode;
  TextEditingController? descontoPlusTextController;
  String? Function(BuildContext, String?)? descontoPlusTextControllerValidator;
  // State field(s) for pontos_black widget.
  FocusNode? pontosBlackFocusNode;
  TextEditingController? pontosBlackTextController;
  String? Function(BuildContext, String?)? pontosBlackTextControllerValidator;
  // State field(s) for desconto_black widget.
  FocusNode? descontoBlackFocusNode;
  TextEditingController? descontoBlackTextController;
  String? Function(BuildContext, String?)? descontoBlackTextControllerValidator;
  // Model for DimensionInput2 component.
  late DimensionInput2Model dimensionInput2Model2;
  // Model for DimensionInput2 component.
  late DimensionInput2Model dimensionInput2Model3;
  // Model for DimensionInput2 component.
  late DimensionInput2Model dimensionInput2Model4;
  // Model for DimensionInput2 component.
  late DimensionInput2Model dimensionInput2Model5;
  // State field(s) for Switch widget.
  bool? switchValue;

  @override
  void initState(BuildContext context) {
    inputFieldModel = createModel(context, () => InputFieldModel());
    textController1Validator = _textController1Validator;
    dimensionInput2Model1 = createModel(context, () => DimensionInput2Model());
    textController2Validator = _textController2Validator;
    textController3Validator = _textController3Validator;
    dimensionInput2Model2 = createModel(context, () => DimensionInput2Model());
    dimensionInput2Model3 = createModel(context, () => DimensionInput2Model());
    dimensionInput2Model4 = createModel(context, () => DimensionInput2Model());
    dimensionInput2Model5 = createModel(context, () => DimensionInput2Model());
    inputFieldModel.textControllerValidator = _formTextFieldValidator1;
    dimensionInput2Model1.textControllerValidator = _formTextFieldValidator2;
    dimensionInput2Model2.textControllerValidator = _formTextFieldValidator3;
    dimensionInput2Model3.textControllerValidator = _formTextFieldValidator4;
    dimensionInput2Model4.textControllerValidator = _formTextFieldValidator5;
    dimensionInput2Model5.textControllerValidator = _formTextFieldValidator6;
  }

  @override
  void dispose() {
    inputFieldModel.dispose();
    textFieldFocusNode1?.dispose();
    textController1?.dispose();

    dimensionInput2Model1.dispose();
    textFieldFocusNode2?.dispose();
    textController2?.dispose();

    textFieldFocusNode3?.dispose();
    textController3?.dispose();

    pontosPlusFocusNode?.dispose();
    pontosPlusTextController?.dispose();

    descontoPlusFocusNode?.dispose();
    descontoPlusTextController?.dispose();

    pontosBlackFocusNode?.dispose();
    pontosBlackTextController?.dispose();

    descontoBlackFocusNode?.dispose();
    descontoBlackTextController?.dispose();

    dimensionInput2Model2.dispose();
    dimensionInput2Model3.dispose();
    dimensionInput2Model4.dispose();
    dimensionInput2Model5.dispose();
  }

  /// Additional helper methods.

  String? _formTextFieldValidator1(BuildContext context, String? val) {
    if (val == null || val.isEmpty) {
      return 'hint is required';
    }

    return null;
  }

  String? _formTextFieldValidator2(BuildContext context, String? val) {
    if (val == null || val.isEmpty) {
      return 'hint is required';
    }

    return null;
  }

  String? _formTextFieldValidator3(BuildContext context, String? val) {
    if (val == null || val.isEmpty) {
      return 'hint is required';
    }

    return null;
  }

  String? _formTextFieldValidator4(BuildContext context, String? val) {
    if (val == null || val.isEmpty) {
      return 'hint is required';
    }

    return null;
  }

  String? _formTextFieldValidator5(BuildContext context, String? val) {
    if (val == null || val.isEmpty) {
      return 'hint is required';
    }

    return null;
  }

  String? _formTextFieldValidator6(BuildContext context, String? val) {
    if (val == null || val.isEmpty) {
      return 'hint is required';
    }

    return null;
  }
}
