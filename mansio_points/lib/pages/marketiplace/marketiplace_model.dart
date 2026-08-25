import '/backend/backend.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:ui';
import '/index.dart';
import 'marketiplace_widget.dart' show MarketiplaceWidget;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:easy_debounce/easy_debounce.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:infinite_scroll_pagination/infinite_scroll_pagination.dart';
import 'package:provider/provider.dart';

class MarketiplaceModel extends FlutterFlowModel<MarketiplaceWidget> {
  ///  State fields for stateful widgets in this page.

  // State field(s) for TextField widget.
  FocusNode? textFieldFocusNode;
  TextEditingController? textController;
  String? Function(BuildContext, String?)? textControllerValidator;
  // State field(s) for GridView widget.

  PagingController<DocumentSnapshot?, ProdutosRecord>? gridViewPagingController;
  Query? gridViewPagingQuery;
  List<StreamSubscription?> gridViewStreamSubscriptions = [];

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {
    textFieldFocusNode?.dispose();
    textController?.dispose();

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
          nextPageMarker: nextPageMarker,
          streamSubscriptions: gridViewStreamSubscriptions,
          controller: controller,
          pageSize: 10,
          isStream: true,
        ),
      );
  }
}
