import '/components/dimension_input3_widget.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:ui';
import 'novo_produto_widget.dart' show NovoProdutoWidget;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class NovoProdutoModel extends FlutterFlowModel<NovoProdutoWidget> {
  ///  State fields for stateful widgets in this page.

  // State field(s) for TextField widget.
  FocusNode? textFieldFocusNode1;
  TextEditingController? textController1;
  String? Function(BuildContext, String?)? textController1Validator;
  // State field(s) for TextField widget.
  FocusNode? textFieldFocusNode2;
  TextEditingController? textController2;
  String? Function(BuildContext, String?)? textController2Validator;
  // Model for DimensionInput3 component.
  late DimensionInput3Model dimensionInput3Model1;
  // Model for DimensionInput3 component.
  late DimensionInput3Model dimensionInput3Model2;
  // Model for DimensionInput3 component.
  late DimensionInput3Model dimensionInput3Model3;
  // Model for DimensionInput3 component.
  late DimensionInput3Model dimensionInput3Model4;
  // State field(s) for TextField widget.
  FocusNode? textFieldFocusNode3;
  TextEditingController? textController3;
  String? Function(BuildContext, String?)? textController3Validator;

  @override
  void initState(BuildContext context) {
    dimensionInput3Model1 = createModel(context, () => DimensionInput3Model());
    dimensionInput3Model2 = createModel(context, () => DimensionInput3Model());
    dimensionInput3Model3 = createModel(context, () => DimensionInput3Model());
    dimensionInput3Model4 = createModel(context, () => DimensionInput3Model());
  }

  @override
  void dispose() {
    textFieldFocusNode1?.dispose();
    textController1?.dispose();

    textFieldFocusNode2?.dispose();
    textController2?.dispose();

    dimensionInput3Model1.dispose();
    dimensionInput3Model2.dispose();
    dimensionInput3Model3.dispose();
    dimensionInput3Model4.dispose();
    textFieldFocusNode3?.dispose();
    textController3?.dispose();
  }
}
