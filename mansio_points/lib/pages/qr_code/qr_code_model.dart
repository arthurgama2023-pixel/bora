import '/backend/backend.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:ui';
import '/index.dart';
import 'qr_code_widget.dart' show QrCodeWidget;
import 'package:barcode_widget/barcode_widget.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class QrCodeModel extends FlutterFlowModel<QrCodeWidget> {
  ///  State fields for stateful widgets in this page.

  // State field(s) for prontoParaExplorar widget.
  FocusNode? prontoParaExplorarFocusNode;
  TextEditingController? prontoParaExplorarTextController;
  String? Function(BuildContext, String?)?
      prontoParaExplorarTextControllerValidator;

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {
    prontoParaExplorarFocusNode?.dispose();
    prontoParaExplorarTextController?.dispose();
  }
}
