import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/componentes/menu/menu_widget.dart';
import '/componentes/sucesso/sucesso_widget.dart';
import '/flutter_flow/flutter_flow_animations.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:math';
import 'dart:ui';
import '/flutter_flow/random_data_util.dart' as random_data;
import '/index.dart';
import 'detalhes_widget.dart' show DetalhesWidget;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:infinite_scroll_pagination/infinite_scroll_pagination.dart';
import 'package:provider/provider.dart';

class DetalhesModel extends FlutterFlowModel<DetalhesWidget> {
  ///  State fields for stateful widgets in this page.

  // Stores action output result for [Backend Call - Create Document] action in Button widget.
  CupomRecord? cupomSaida;
  // State field(s) for codigo widget.
  FocusNode? codigoFocusNode;
  TextEditingController? codigoTextController;
  String? Function(BuildContext, String?)? codigoTextControllerValidator;
  // State field(s) for GridView widget.

  PagingController<DocumentSnapshot?, ProdutosRecord>? gridViewPagingController;
  Query? gridViewPagingQuery;
  List<StreamSubscription?> gridViewStreamSubscriptions = [];

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {
    codigoFocusNode?.dispose();
    codigoTextController?.dispose();

    gridViewStreamSubscriptions.forEach((s) => s?.cancel());
    gridViewPagingController?.dispose();
  }

  /// Additional helper methods.
  PagingController<DocumentSnapshot?, ProdutosRecord> setGridViewController(
    Query query, {
    DocumentReference<Object?>? parent,
  }) {
    gridViewPagingController ??= _createGridViewController(query, parent);
    if (gridViewPagingQuery != query) {
      gridViewPagingQuery = query;
      gridViewPagingController?.refresh();
    }
    return gridViewPagingController!;
  }

  PagingController<DocumentSnapshot?, ProdutosRecord> _createGridViewController(
    Query query,
    DocumentReference<Object?>? parent,
  ) {
    final controller =
        PagingController<DocumentSnapshot?, ProdutosRecord>(firstPageKey: null);
    return controller
      ..addPageRequestListener(
        (nextPageMarker) => queryProdutosRecordPage(
          queryBuilder: (_) => gridViewPagingQuery ??= query,
          nextPageMarker: nextPageMarker,
          streamSubscriptions: gridViewStreamSubscriptions,
          controller: controller,
          pageSize: 10,
          isStream: true,
        ),
      );
  }
}
