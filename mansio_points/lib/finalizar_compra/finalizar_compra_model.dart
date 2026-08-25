import '/backend/backend.dart';
import '/components/cart_item_widget.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:ui';
import '/flutter_flow/custom_functions.dart' as functions;
import '/index.dart';
import 'finalizar_compra_widget.dart' show FinalizarCompraWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class FinalizarCompraModel extends FlutterFlowModel<FinalizarCompraWidget> {
  ///  State fields for stateful widgets in this page.

  // Model for cart_item component.
  late CartItemModel cartItemModel;
  // State field(s) for TextField widget.
  FocusNode? textFieldFocusNode;
  TextEditingController? textController;
  String? Function(BuildContext, String?)? textControllerValidator;

  @override
  void initState(BuildContext context) {
    cartItemModel = createModel(context, () => CartItemModel());
  }

  @override
  void dispose() {
    cartItemModel.dispose();
    textFieldFocusNode?.dispose();
    textController?.dispose();
  }
}
